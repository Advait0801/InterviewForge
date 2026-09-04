"""
The golden evaluation set.

30 queries spanning company x stage x difficulty, each labelled with the corpus
sources that *should* be retrieved. Labels are source names from
seed_data/documents.json, so they survive re-chunking: a chunk is judged
relevant if its `source` metadata is in the labelled set.

Deliberately kept small. Every entry is hand-labelled, and a set this size can
be re-run for free (retrieval metrics need no LLM) while staying big enough that
a real regression moves the numbers.

Query kinds:
  - "synthetic": what build_retrieval_query() actually produces in production.
  - "natural":   how a person would phrase it. Shorter, vaguer, no company/stage
                 scaffolding — this is where dense-only retrieval tends to fail,
                 so it is the interesting half for Phases 2 and 3.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass(frozen=True)
class GoldenQuery:
    id: str
    query: str
    company: Optional[str]
    stage: Optional[str]
    difficulty: str
    relevant_sources: List[str]
    kind: str = "natural"
    notes: str = ""


GOLDEN_SET: List[GoldenQuery] = [
    # ---------- Amazon ----------
    GoldenQuery(
        id="amz-beh-1",
        query="Amazon behavioral interview. Topic: ownership and customer obsession stories. "
              "Difficulty: medium. Focus areas: ownership, customer obsession, trade-offs, scalability.",
        company="amazon", stage="behavioral", difficulty="medium",
        relevant_sources=["amazon_behavioral"],
        kind="synthetic",
    ),
    GoldenQuery(
        id="amz-beh-2",
        query="How does Amazon use the STAR method and leadership principles in interviews?",
        company="amazon", stage="behavioral", difficulty="easy",
        relevant_sources=["amazon_behavioral"],
    ),
    GoldenQuery(
        id="amz-sd-1",
        query="Designing systems that survive Prime Day style traffic peaks",
        company="amazon", stage="system_design", difficulty="hard",
        relevant_sources=["amazon_system_design_peak_events", "amazon_system_design"],
    ),
    GoldenQuery(
        id="amz-sd-2",
        query="Amazon system design interview. Topic: scalable systems with trade-off analysis. "
              "Difficulty: medium.",
        company="amazon", stage="system_design", difficulty="medium",
        relevant_sources=["amazon_system_design", "amazon_system_design_peak_events"],
        kind="synthetic",
    ),
    GoldenQuery(
        id="amz-cod-1",
        query="Explaining trade-offs out loud while coding at Amazon",
        company="amazon", stage="coding", difficulty="medium",
        relevant_sources=["amazon_coding_lp_walkthrough"],
    ),
    GoldenQuery(
        id="amz-cs-1",
        query="How does Amazon think about large scale storage fundamentals?",
        company="amazon", stage="core_cs", difficulty="hard",
        relevant_sources=["amazon_core_cs_large_scale_storage"],
    ),

    # ---------- Google ----------
    GoldenQuery(
        id="goo-cod-1",
        query="Google coding interview. Topic: problem solving with clear reasoning and edge cases. "
              "Difficulty: medium. Focus areas: algorithms, data structures, complexity.",
        company="google", stage="coding", difficulty="medium",
        relevant_sources=["google_algorithms", "google_coding_communication"],
        kind="synthetic",
    ),
    GoldenQuery(
        id="goo-cod-2",
        query="two pointer and sliding window patterns for array problems",
        company="google", stage="coding", difficulty="easy",
        relevant_sources=["google_algorithms"],
        notes="Rare-term query: exact technique names. Dense-only retrieval "
              "tends to underperform here; hybrid BM25 should help in Phase 3.",
    ),
    GoldenQuery(
        id="goo-cod-3",
        query="how much should I narrate my thinking during a Google interview",
        company="google", stage="coding", difficulty="medium",
        relevant_sources=["google_coding_communication"],
    ),
    GoldenQuery(
        id="goo-sd-1",
        query="Google system design expectations for scale and reliability",
        company="google", stage="system_design", difficulty="hard",
        relevant_sources=["google_system_design"],
    ),
    GoldenQuery(
        id="goo-beh-1",
        query="handling ambiguous problems with little direction at Google",
        company="google", stage="behavioral", difficulty="hard",
        relevant_sources=["google_behavioral_ambiguity", "google_behavioral"],
    ),
    GoldenQuery(
        id="goo-cs-1",
        query="CAP theorem and consistency models",
        company="google", stage="core_cs", difficulty="hard",
        relevant_sources=["google_core_cs_distributed_theory", "distributed_systems_fundamentals"],
    ),
    GoldenQuery(
        id="goo-cs-2",
        query="TCP handshake, congestion control and networking internals",
        company="google", stage="core_cs", difficulty="hard",
        relevant_sources=["google_core_cs_networking_deep"],
        notes="Rare-term query.",
    ),

    # ---------- Meta ----------
    GoldenQuery(
        id="met-cod-1",
        query="Meta coding interview. Topic: practical coding and performance. Difficulty: medium.",
        company="meta", stage="coding", difficulty="medium",
        relevant_sources=["meta_coding", "meta_coding_graph_social"],
        kind="synthetic",
    ),
    GoldenQuery(
        id="met-cod-2",
        query="graph problems on a social network, friends of friends",
        company="meta", stage="coding", difficulty="medium",
        relevant_sources=["meta_coding_graph_social"],
    ),
    GoldenQuery(
        id="met-sd-1",
        query="presence indicators, typing status and live counters",
        company="meta", stage="system_design", difficulty="hard",
        relevant_sources=["meta_system_design_realtime"],
    ),
    GoldenQuery(
        id="met-sd-2",
        query="Meta system design interview expectations at scale",
        company="meta", stage="system_design", difficulty="medium",
        relevant_sources=["meta_system_design", "meta_system_design_realtime"],
    ),
    GoldenQuery(
        id="met-beh-1",
        query="move fast and ship, demonstrating impact at Meta",
        company="meta", stage="behavioral", difficulty="medium",
        relevant_sources=["meta_behavioral_shipping", "meta_behavioral"],
    ),
    GoldenQuery(
        id="met-cs-1",
        query="caching layers and invalidation at very large scale",
        company="meta", stage="core_cs", difficulty="hard",
        relevant_sources=["meta_core_cs_caching_scale"],
    ),

    # ---------- Apple ----------
    GoldenQuery(
        id="app-beh-1",
        query="Apple's quality bar and attention to detail in behavioral interviews",
        company="apple", stage="behavioral", difficulty="medium",
        relevant_sources=["apple_behavioral_quality_bar", "apple_behavioral"],
    ),
    GoldenQuery(
        id="app-sd-1",
        query="designing for user privacy and on-device processing",
        company="apple", stage="system_design", difficulty="hard",
        relevant_sources=["apple_system_design_privacy", "apple_system_design"],
    ),
    GoldenQuery(
        id="app-cod-1",
        query="writing clean performant code for client software",
        company="apple", stage="coding", difficulty="medium",
        relevant_sources=["apple_coding_clean_performance"],
    ),
    GoldenQuery(
        id="app-cs-1",
        query="false sharing, cache lines and priority inversion",
        company="apple", stage="core_cs", difficulty="hard",
        relevant_sources=["apple_core_cs_memory_concurrency"],
        notes="Rare-term query: very specific systems vocabulary.",
    ),
    GoldenQuery(
        id="app-cs-2",
        query="why does the UI stutter and how do I move work off the main thread",
        company="apple", stage="core_cs", difficulty="medium",
        relevant_sources=["apple_core_cs_memory_concurrency"],
        notes="Symptom-phrased rather than term-phrased: tests semantic matching.",
    ),

    # ---------- Company-agnostic fundamentals ----------
    GoldenQuery(
        id="fun-sd-1",
        query="hash based vs range based sharding trade-offs",
        company=None, stage="system_design", difficulty="medium",
        relevant_sources=["fundamentals_database_sharding"],
    ),
    GoldenQuery(
        id="fun-sd-2",
        query="write-through vs write-back caching and eviction policies",
        company=None, stage="system_design", difficulty="medium",
        relevant_sources=["fundamentals_caching_strategies"],
    ),
    GoldenQuery(
        id="fun-sd-3",
        query="when to use a message queue for decoupling services",
        company=None, stage="system_design", difficulty="easy",
        relevant_sources=["fundamentals_message_queues"],
    ),
    GoldenQuery(
        id="fun-sd-4",
        query="designing a clean REST API with good status codes",
        company=None, stage="system_design", difficulty="easy",
        relevant_sources=["fundamentals_rest_api_design"],
    ),
    GoldenQuery(
        id="fun-sd-5",
        query="metrics, logs and traces for understanding production",
        company=None, stage="system_design", difficulty="medium",
        relevant_sources=["fundamentals_observability"],
    ),
    GoldenQuery(
        id="fun-cs-1",
        query="common web vulnerabilities and how to defend against them",
        company=None, stage="core_cs", difficulty="medium",
        relevant_sources=["fundamentals_security_interview"],
    ),

    # ---------- Ingested engineering-blog content (Phase 4) ----------
    # These are the queries that actually make the benchmark hard. The 34 seed
    # documents cover 16 well-separated topics with no competition, so they
    # saturate every metric. The blog corpus has genuine near-collisions --
    # AWS and Microsoft both write about MCP servers, Airbnb and Dropbox both
    # about GenAI evaluation -- which is what retrieval has to discriminate.
    GoldenQuery(
        id="blog-flink",
        query="autoscaling Apache Flink streaming jobs",
        company=None, stage="system_design", difficulty="hard",
        relevant_sources=['batch::netflix_tech::d541eecfda7d0718264dbf08019c1b3f'],
        notes="Answer lives in ingested engineering-blog content, where many "
              "topically adjacent articles compete.",
    ),
    GoldenQuery(
        id="blog-graph",
        query="building a real-time distributed graph database for queries",
        company=None, stage="system_design", difficulty="hard",
        relevant_sources=['batch::netflix_tech::690793a27e30486963070a66d0c60d04'],
        notes="Answer lives in ingested engineering-blog content, where many "
              "topically adjacent articles compete.",
    ),
    GoldenQuery(
        id="blog-zstd",
        query="using Zstandard compression to reduce cache storage costs",
        company=None, stage="system_design", difficulty="medium",
        relevant_sources=['batch::cloudflare_blog::3358acf7c004013790a780c46c93c215'],
        notes="Answer lives in ingested engineering-blog content, where many "
              "topically adjacent articles compete.",
    ),
    GoldenQuery(
        id="blog-rdma",
        query="RDMA transport over ethernet for AI training clusters",
        company=None, stage="core_cs", difficulty="hard",
        relevant_sources=['batch::meta_eng::d2835f9807e2ac5c50126ae8a28ea50b'],
        notes="Answer lives in ingested engineering-blog content, where many "
              "topically adjacent articles compete.",
    ),
    GoldenQuery(
        id="blog-mtia",
        query="custom training chip with built-in network interfaces",
        company=None, stage="core_cs", difficulty="hard",
        relevant_sources=['batch::meta_eng::e10619a31890878acd7ca80c9ca7f63b'],
        notes="Answer lives in ingested engineering-blog content, where many "
              "topically adjacent articles compete.",
    ),
    GoldenQuery(
        id="blog-zgw",
        query="putting a proxy in front of a key value store",
        company=None, stage="system_design", difficulty="hard",
        relevant_sources=['batch::meta_eng::61f1aa6da8d63daf439966b5f861c913'],
        notes="Answer lives in ingested engineering-blog content, where many "
              "topically adjacent articles compete.",
    ),
    GoldenQuery(
        id="blog-evals",
        query="eval driven development for generative AI at scale",
        company=None, stage="core_cs", difficulty="medium",
        relevant_sources=['batch::airbnb_eng::ca6079ed8c27b1cd2015464e8f96795b'],
        notes="Answer lives in ingested engineering-blog content, where many "
              "topically adjacent articles compete.",
    ),
    GoldenQuery(
        id="blog-dspy",
        query="using DSPy to improve AI evaluation responses in chat",
        company=None, stage="core_cs", difficulty="medium",
        relevant_sources=['batch::dropbox_tech::f972b7da95a7c6f07fabce6227c0ed50'],
        notes="Answer lives in ingested engineering-blog content, where many "
              "topically adjacent articles compete.",
    ),
    GoldenQuery(
        id="blog-authn",
        query="redesigning authentication for millions of users",
        company=None, stage="system_design", difficulty="hard",
        relevant_sources=['batch::airbnb_eng::80289671873347c21f0b99f464d0cd1b'],
        notes="Answer lives in ingested engineering-blog content, where many "
              "topically adjacent articles compete.",
    ),
    GoldenQuery(
        id="blog-mcp",
        query="deploying a stateless MCP server following well architected principles",
        company=None, stage="system_design", difficulty="medium",
        relevant_sources=['batch::aws_arch::455c459d9a3063bc0e3d01a4bf30675f'],
        notes="Answer lives in ingested engineering-blog content, where many "
              "topically adjacent articles compete.",
    ),
    GoldenQuery(
        id="blog-isabelle",
        query="verifying distributed systems with Isabelle HOL proof assistant",
        company=None, stage="core_cs", difficulty="hard",
        relevant_sources=['batch::martin_kleppmann::60c4c6ce63ff92802b9f6db3a1235883'],
        notes="Answer lives in ingested engineering-blog content, where many "
              "topically adjacent articles compete.",
    ),
    GoldenQuery(
        id="blog-riviera",
        query="universal content processing platform for large media assets",
        company=None, stage="system_design", difficulty="hard",
        relevant_sources=['batch::dropbox_tech::1f9b3059a0a1b2a43f28371371c19b26'],
        notes="Answer lives in ingested engineering-blog content, where many "
              "topically adjacent articles compete.",
    ),
]


def by_id(query_id: str) -> GoldenQuery:
    for q in GOLDEN_SET:
        if q.id == query_id:
            return q
    raise KeyError(query_id)
