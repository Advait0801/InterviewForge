# Baseline — retrieval quality

Phase 1 baseline, measured before any Phase 2/3 retrieval changes.
Reproduce with `docker compose exec ai-service python -m app.eval.run --k 5`.

> ## ⚠️ Read this before using the baseline
>
> **The benchmark is saturated.** hit_rate 1.000, MRR 1.000, nDCG 0.987,
> normalised precision 0.983 — retrieval is already at ~98% of the achievable
> ceiling, both with and without the metadata filter.
>
> This is not a sign that retrieval is excellent. It is a sign that the **task is
> too easy**: 34 documents covering 16 well-separated company × stage topics, so
> almost every query has exactly one obviously-correct document and no real
> competition. Dense embeddings win trivially.
>
> **Consequence: Phases 2 and 3 cannot demonstrate improvement against this
> corpus.** There is ~1.3% of nDCG headroom, which is smaller than the noise a
> corpus change would introduce. Reranking, hybrid search, and better chunking
> are all designed to fix failures that this corpus does not contain.
>
> See D-012 for the resulting plan change.

## Overall

| Metric | Score |
|---|---|
| precision_at_k | 0.260 |
| precision_norm | 0.983 |
| recall_at_k | 0.983 |
| hit_rate | 1.000 |
| mrr | 1.000 |
| ndcg_at_k | 0.987 |

## By query kind

| Kind | precision_at_k | precision_norm | recall_at_k | hit_rate | mrr | ndcg_at_k |
|---|---|---|---|---|---|---|
| natural | 0.246 | 0.981 | 0.981 | 1.000 | 1.000 | 0.985 |
| synthetic | 0.350 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 |

## Per query

| id | kind | hit | mrr | ndcg | expected | retrieved (top) |
|---|---|---|---|---|---|---|
| `goo-cs-1` | natural | 1 | 1.00 | 0.61 | google_core_cs_distributed_theory, distributed_systems_fundamentals | google_core_cs_distributed_theory, google_core_cs_networking_deep |
| `amz-beh-1` | synthetic | 1 | 1.00 | 1.00 | amazon_behavioral | amazon_behavioral |
| `amz-beh-2` | natural | 1 | 1.00 | 1.00 | amazon_behavioral | amazon_behavioral |
| `amz-sd-1` | natural | 1 | 1.00 | 1.00 | amazon_system_design_peak_events, amazon_system_design | amazon_system_design_peak_events, amazon_system_design |
| `amz-sd-2` | synthetic | 1 | 1.00 | 1.00 | amazon_system_design, amazon_system_design_peak_events | amazon_system_design, amazon_system_design_peak_events |
| `amz-cod-1` | natural | 1 | 1.00 | 1.00 | amazon_coding_lp_walkthrough | amazon_coding_lp_walkthrough |
| `amz-cs-1` | natural | 1 | 1.00 | 1.00 | amazon_core_cs_large_scale_storage | amazon_core_cs_large_scale_storage |
| `goo-cod-1` | synthetic | 1 | 1.00 | 1.00 | google_algorithms, google_coding_communication | google_coding_communication, google_algorithms |
| `goo-cod-2` | natural | 1 | 1.00 | 1.00 | google_algorithms | google_algorithms, google_coding_communication |
| `goo-cod-3` | natural | 1 | 1.00 | 1.00 | google_coding_communication | google_coding_communication, google_algorithms |
| `goo-sd-1` | natural | 1 | 1.00 | 1.00 | google_system_design | google_system_design |
| `goo-beh-1` | natural | 1 | 1.00 | 1.00 | google_behavioral_ambiguity, google_behavioral | google_behavioral_ambiguity, google_behavioral |
| `goo-cs-2` | natural | 1 | 1.00 | 1.00 | google_core_cs_networking_deep | google_core_cs_networking_deep, google_core_cs_distributed_theory |
| `met-cod-1` | synthetic | 1 | 1.00 | 1.00 | meta_coding, meta_coding_graph_social | meta_coding, meta_coding_graph_social |
| `met-cod-2` | natural | 1 | 1.00 | 1.00 | meta_coding_graph_social | meta_coding_graph_social, meta_coding |
| `met-sd-1` | natural | 1 | 1.00 | 1.00 | meta_system_design_realtime | meta_system_design_realtime, meta_system_design |
| `met-sd-2` | natural | 1 | 1.00 | 1.00 | meta_system_design, meta_system_design_realtime | meta_system_design, meta_system_design_realtime |
| `met-beh-1` | natural | 1 | 1.00 | 1.00 | meta_behavioral_shipping, meta_behavioral | meta_behavioral_shipping, meta_behavioral |
| `met-cs-1` | natural | 1 | 1.00 | 1.00 | meta_core_cs_caching_scale | meta_core_cs_caching_scale |
| `app-beh-1` | natural | 1 | 1.00 | 1.00 | apple_behavioral_quality_bar, apple_behavioral | apple_behavioral_quality_bar, apple_behavioral |
| `app-sd-1` | natural | 1 | 1.00 | 1.00 | apple_system_design_privacy, apple_system_design | apple_system_design_privacy, apple_system_design |
| `app-cod-1` | natural | 1 | 1.00 | 1.00 | apple_coding_clean_performance | apple_coding_clean_performance |
| `app-cs-1` | natural | 1 | 1.00 | 1.00 | apple_core_cs_memory_concurrency | apple_core_cs_memory_concurrency |
| `app-cs-2` | natural | 1 | 1.00 | 1.00 | apple_core_cs_memory_concurrency | apple_core_cs_memory_concurrency |
| `fun-sd-1` | natural | 1 | 1.00 | 1.00 | fundamentals_database_sharding | fundamentals_database_sharding, distributed_systems_fundamentals, fundamentals_caching_strategies |
| `fun-sd-2` | natural | 1 | 1.00 | 1.00 | fundamentals_caching_strategies | fundamentals_caching_strategies, distributed_systems_fundamentals, fundamentals_message_queues |
| `fun-sd-3` | natural | 1 | 1.00 | 1.00 | fundamentals_message_queues | fundamentals_message_queues, distributed_systems_fundamentals, amazon_system_design_peak_events |
| `fun-sd-4` | natural | 1 | 1.00 | 1.00 | fundamentals_rest_api_design | fundamentals_rest_api_design, fundamentals_observability, amazon_system_design |
| `fun-sd-5` | natural | 1 | 1.00 | 1.00 | fundamentals_observability | fundamentals_observability, fundamentals_message_queues, distributed_systems_fundamentals |
| `fun-cs-1` | natural | 1 | 1.00 | 1.00 | fundamentals_security_interview | fundamentals_security_interview, core_cs_fundamentals, google_core_cs_networking_deep |
