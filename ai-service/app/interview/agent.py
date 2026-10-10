"""
The interviewer agent (D-067): after an answer, decide whether to probe, pivot, advance
or finish, searching the corpus first if that helps.

A bounded ReAct loop over JSON steps (see `agent_step_chain` for why not native tool
calls). The backend, not this loop, owns the interview's rules: it sends the moves that
are allowed right now and enforces them again on the way back. This module only promises
that whatever it returns is one of those moves, well-formed -- anything else comes back as
`fallback`, and the backend runs the fixed flow for that turn.
"""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from app.interview.orchestrator import build_context_from_hits

MAX_STEPS = 3
MAX_SEARCHES = 2
SEARCH_TOP_K = 3
OBSERVATION_CHARS = 1500
ACTIONS = ("probe", "pivot", "advance", "finish")


def search(rag: Any, *, company: str, stage: str, query: str) -> List[Dict[str, Any]]:
    """Local, dense-only retrieval for the company's stage material.

    No `stage=` on purpose: that would route behavioural and system-design queries through
    the LLM reranker, an extra model call per search. No live fetch either: the agent must
    not spend the live-ingestion budget or write to the corpus on a whim."""
    where = {"$and": [{"company": {"$eq": company}}, {"stage": {"$eq": stage}}]}
    hits = rag.retrieve(query, top_k=SEARCH_TOP_K, where=where)["hits"]
    if not hits:
        hits = rag.retrieve(query, top_k=SEARCH_TOP_K)["hits"]
    return hits


def _transcript(turns: List[Dict[str, str]]) -> str:
    if not turns:
        return "Nothing yet; the latest question is the stage's first."
    return "\n".join(f"{t.get('role', '?')}: {str(t.get('content', ''))[:600]}" for t in turns[-12:])


async def run_agent(*, rag: Any, invoke, chain, payload: Dict[str, Any], allowed: List[str]) -> Dict[str, Any]:
    """Run the loop. `invoke(chain, payload)` is invoke_with_fallback, injected for tests."""
    scratch: List[str] = []
    contexts: List[str] = []
    trace: List[Dict[str, Any]] = []
    searches = 0

    for step in range(MAX_STEPS):
        must_decide = step == MAX_STEPS - 1 or searches >= MAX_SEARCHES
        notes = "\n".join(scratch) or "None."
        if must_decide:
            notes += "\nYou must decide now: return the decide step."
        out = await invoke(chain, {**payload, "scratchpad": notes})
        out = out if isinstance(out, dict) else {}
        tool = str(out.get("tool", "")).strip()

        if tool == "search_context" and not must_decide:
            query = str(out.get("query", "")).strip()
            if not query:
                scratch.append("(an empty search was ignored)")
                continue
            hits = search(rag, company=payload["company"], stage=payload["stage"], query=query)
            observation = build_context_from_hits(hits)[:OBSERVATION_CHARS]
            searches += 1
            contexts.append(observation)
            trace.append({"tool": "search_context", "query": query, "hits": len(hits)})
            scratch.append(f"search_context({json.dumps(query)}) returned:\n{observation}")
            continue

        if tool == "decide":
            decision = _validate(out, allowed)
            trace.append({"tool": "decide", "action": decision["action"]})
            if decision["action"] == "pivot" and not contexts:
                # A new question should be grounded like every other one; if the agent didn't
                # look anything up, search on its own focus (embedding only, no model call).
                hits = search(rag, company=payload["company"], stage=payload["stage"],
                              query=decision["focus"] or decision["question"])
                contexts.append(build_context_from_hits(hits)[:OBSERVATION_CHARS])
                trace.append({"tool": "search_context", "query": decision["focus"] or decision["question"],
                              "hits": len(hits), "automatic": True})
            return {**decision, "context": "\n\n---\n\n".join(contexts), "trace": trace, "steps": step + 1,
                    "thought": str(out.get("thought", ""))}

        scratch.append(f"(step ignored: expected search_context or decide, got {tool or 'nothing'!r})")

    return _fallback("no decision within the step limit", trace, MAX_STEPS)


def _validate(out: Dict[str, Any], allowed: List[str]) -> Dict[str, Any]:
    action = str(out.get("action", "")).strip().lower()
    question = str(out.get("question", "")).strip()
    focus = str(out.get("focus", "")).strip()
    rationale = str(out.get("rationale", "")).strip()
    if action not in ACTIONS:
        return {**_fallback(f"unknown action {action!r}", [], 0), "proposed": action}
    if action not in allowed:
        return {**_fallback(f"{action} is not allowed now", [], 0), "proposed": action}
    if action in ("probe", "pivot") and not question:
        return {**_fallback(f"{action} without a question", [], 0), "proposed": action}
    return {"action": action, "question": question if action in ("probe", "pivot") else "",
            "focus": focus, "rationale": rationale, "fallback": False}


def _fallback(reason: str, trace: List[Dict[str, Any]], steps: int) -> Dict[str, Any]:
    return {"action": "fallback", "question": "", "focus": "", "rationale": reason, "fallback": True,
            "context": "", "trace": trace, "steps": steps, "thought": ""}
