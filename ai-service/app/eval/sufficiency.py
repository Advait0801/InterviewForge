"""
Context sufficiency: can the retrieved context actually answer the question?

Retrieval metrics score *ranking* -- did the right document come back, and how
high. They are blind to whether the returned text is complete enough to answer
with, which is exactly what small-to-big retrieval changes: it does not move a
single rank, it widens each hit.

So this scores the other half. A judge sees only the question and the retrieved
context, and rates how completely the context supports an answer (1-5). Run it
with different PARENT_WINDOW values to price the trade-off, because expansion
buys completeness with prompt tokens.

    python -m app.eval.sufficiency --window 0 --window 1
"""
from __future__ import annotations

import argparse
import asyncio
import json
from typing import Any, Dict, List

from app.core import config
from app.eval.golden_set import GOLDEN_SET
from app.rag.service import RAGService

RUBRIC = """You are grading whether a retrieved context is sufficient to answer a question.

Score 1-5:
5 = fully sufficient; the context directly and completely answers the question
4 = mostly sufficient; minor gaps
3 = partially sufficient; the topic is present but key detail is missing or cut off
2 = barely relevant; the context touches the topic but cannot support an answer
1 = insufficient or irrelevant

Judge ONLY the context provided. Do not use outside knowledge.
Return JSON: {{"score": <1-5>, "reason": "<one short sentence>"}}"""


async def _judge(question: str, context: str) -> Dict[str, Any]:
    from langchain_core.output_parsers import JsonOutputParser
    from langchain_core.prompts import ChatPromptTemplate

    from app.llm.chains import _get_llm, invoke_with_fallback

    def factory(provider=None):
        parser = JsonOutputParser()
        prompt = ChatPromptTemplate.from_messages([
            ("system", RUBRIC),
            ("human", "## Question\n{question}\n\n## Retrieved context\n{context}"),
        ])
        return prompt | _get_llm(provider) | parser

    return await invoke_with_fallback(factory, {"question": question, "context": context[:12000]})


async def run(windows: List[int], *, sample: int, top_k: int) -> Dict[str, Any]:
    queries = [q for q in GOLDEN_SET if q.kind == "natural"][:sample]
    results: Dict[str, Any] = {"top_k": top_k, "sample": len(queries), "by_window": {}}

    for window in windows:
        config.PARENT_WINDOW = window
        rag = RAGService()
        scores, chars = [], []
        for q in queries:
            hits = rag.retrieve(q.query, top_k=top_k)["hits"]
            context = "\n\n---\n\n".join(
                str(h.get("parent_text") or h["text"]) for h in hits
            )
            chars.append(len(context))
            verdict = await _judge(q.query, context)
            scores.append(int(verdict.get("score", 0)))
        results["by_window"][str(window)] = {
            "mean_score": sum(scores) / len(scores) if scores else 0.0,
            "mean_context_chars": sum(chars) / len(chars) if chars else 0,
            "scores": scores,
        }
    return results


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--window", type=int, action="append", default=None)
    ap.add_argument("--sample", type=int, default=8)
    ap.add_argument("--k", type=int, default=5)
    args = ap.parse_args()
    windows = args.window or [0, 1]

    report = asyncio.run(run(windows, sample=args.sample, top_k=args.k))
    print(json.dumps(report["by_window"], indent=2))
    print()
    base = report["by_window"][str(windows[0])]
    for w in windows:
        row = report["by_window"][str(w)]
        delta = row["mean_score"] - base["mean_score"]
        ratio = row["mean_context_chars"] / max(base["mean_context_chars"], 1)
        print(f"window={w}  sufficiency={row['mean_score']:.2f} ({delta:+.2f})  "
              f"context={row['mean_context_chars']:.0f} chars ({ratio:.2f}x)")


if __name__ == "__main__":
    main()
