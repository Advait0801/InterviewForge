# Phase 4 baseline — retrieval quality on the expanded corpus

Supersedes `baseline.md` (Phase 1), which was measured on the 34-document seed
corpus and was saturated. **This is the baseline Phases 2 and 3 are measured against.**

Reproduce: `docker compose exec ai-service python -m app.eval.run --k 5 --no-filter`

## Why this baseline is usable and the old one was not

| Metric | Phase 1 (36 chunks) | Phase 4 (609 chunks) | Headroom gained |
|---|---|---|---|
| nDCG@5 | 0.987 | **0.813** | 17.4 pts |
| MRR | 1.000 | **0.829** | 17.1 pts |
| hit_rate@5 | 1.000 | **0.857** | 14.3 pts |
| precision_norm | 0.983 | **0.833** | 15.0 pts |

Two changes made the benchmark meaningful, and only the second one mattered:

1. **Corpus size** — 36 → 609 chunks via batch ingestion of 13 engineering blogs.
   On its own this barely moved the numbers (nDCG 0.987 → 0.975), because the new
   content was topically orthogonal to the golden queries.
2. **Golden queries over the ingested content** — 12 new queries whose answers
   live in the blog corpus, where topically adjacent articles genuinely compete
   (AWS and Microsoft both publish on MCP servers; Airbnb and Dropbox both on
   GenAI evaluation; Kleppmann has two formal-verification pieces).

**The lesson worth keeping: corpus size does not create benchmark difficulty —
topical overlap does.** A large corpus of unrelated documents is just as easy as
a small one.

## What this means for Phases 2 and 3

- 14% of queries now miss their answer entirely → **hybrid/BM25 has recall to recover**.
- MRR 0.829 → the right document is often retrieved but not ranked first →
  **reranking has misordering to fix**.
- Blog articles are long and multi-topic, unlike the single-idea seed docs →
  **semantic chunking and small-to-big retrieval now have something to do**.

## Overall

| Metric | Score |
|---|---|
| precision_at_k | 0.205 |
| precision_norm | 0.833 |
| recall_at_k | 0.833 |
| hit_rate | 0.857 |
| mrr | 0.829 |
| ndcg_at_k | 0.813 |

## By query kind

| Kind | precision_at_k | precision_norm | recall_at_k | hit_rate | mrr | ndcg_at_k |
|---|---|---|---|---|---|---|
| natural | 0.195 | 0.829 | 0.829 | 0.842 | 0.829 | 0.818 |
| synthetic | 0.300 | 0.875 | 0.875 | 1.000 | 0.833 | 0.758 |

## Per query

| id | kind | hit | mrr | ndcg | expected | retrieved (top) |
|---|---|---|---|---|---|---|
| `goo-cod-3` | natural | 0 | 0.00 | 0.00 | google_coding_communication | google_behavioral, google_algorithms, google_system_design |
| `goo-cs-1` | natural | 0 | 0.00 | 0.00 | google_core_cs_distributed_theory, distributed_systems_fundamentals | batch::meta_eng::c4d795ee1c472a3eb904462ce8605936, batch::microsoft_devblog::012c73d04c2e0cc4c2b2ed6d7ccf861c, batch::microsoft_devblog::66e762c52b4fb40c0d9e6b7d96ab914f |
| `app-cod-1` | natural | 0 | 0.00 | 0.00 | apple_coding_clean_performance | batch::airbnb_eng::80289671873347c21f0b99f464d0cd1b, batch::martin_kleppmann::17ac1a3f895b9b48feb259b2c4d542c5, batch::microsoft_devblog::fe06a477ca974da7e55cda7c8c58d2b9 |
| `app-cs-1` | natural | 0 | 0.00 | 0.00 | apple_core_cs_memory_concurrency | batch::meta_eng::61f1aa6da8d63daf439966b5f861c913, batch::netflix_tech::690793a27e30486963070a66d0c60d04, fundamentals_caching_strategies |
| `app-cs-2` | natural | 0 | 0.00 | 0.00 | apple_core_cs_memory_concurrency | batch::netflix_tech::690793a27e30486963070a66d0c60d04, batch::netflix_tech::d541eecfda7d0718264dbf08019c1b3f |
| `fun-cs-1` | natural | 0 | 0.00 | 0.00 | fundamentals_security_interview | batch::cloudflare_blog::a4a986b959c496e86f16153314d8f74e |
| `amz-beh-1` | synthetic | 1 | 0.33 | 0.50 | amazon_behavioral | amazon_coding_lp_walkthrough, apple_behavioral, amazon_behavioral |
| `met-cod-1` | synthetic | 1 | 1.00 | 0.61 | meta_coding, meta_coding_graph_social | meta_coding, google_algorithms, apple_coding_clean_performance |
| `app-sd-1` | natural | 1 | 1.00 | 0.61 | apple_system_design_privacy, apple_system_design | apple_system_design_privacy, batch::dropbox_tech::32666d093ba2af855eceec6c920057f2, batch::martin_kleppmann::17ac1a3f895b9b48feb259b2c4d542c5 |
| `met-cs-1` | natural | 1 | 0.50 | 0.63 | meta_core_cs_caching_scale | batch::netflix_tech::690793a27e30486963070a66d0c60d04, meta_core_cs_caching_scale |
| `met-sd-2` | natural | 1 | 1.00 | 0.85 | meta_system_design, meta_system_design_realtime | meta_system_design, amazon_system_design, google_system_design |
| `amz-sd-2` | synthetic | 1 | 1.00 | 0.92 | amazon_system_design, amazon_system_design_peak_events | amazon_system_design, amazon_coding_lp_walkthrough, amazon_system_design_peak_events |
| `amz-beh-2` | natural | 1 | 1.00 | 1.00 | amazon_behavioral | amazon_behavioral, amazon_coding_lp_walkthrough, amazon_system_design |
| `amz-sd-1` | natural | 1 | 1.00 | 1.00 | amazon_system_design_peak_events, amazon_system_design | amazon_system_design_peak_events, amazon_system_design, batch::dropbox_tech::c1a49ce9bd0f47f7d934bccf61649df0 |
| `amz-cod-1` | natural | 1 | 1.00 | 1.00 | amazon_coding_lp_walkthrough | amazon_coding_lp_walkthrough, apple_coding_clean_performance, batch::brendangregg::d6776b65a6a9132dc47f74cb2a72aae7 |
| `amz-cs-1` | natural | 1 | 1.00 | 1.00 | amazon_core_cs_large_scale_storage | amazon_core_cs_large_scale_storage, amazon_system_design_peak_events, batch::dropbox_tech::c1a49ce9bd0f47f7d934bccf61649df0 |
| `goo-cod-1` | synthetic | 1 | 1.00 | 1.00 | google_algorithms, google_coding_communication | google_algorithms, google_coding_communication, amazon_coding_lp_walkthrough |
| `goo-cod-2` | natural | 1 | 1.00 | 1.00 | google_algorithms | google_algorithms, apple_coding_clean_performance, meta_coding |
| `goo-sd-1` | natural | 1 | 1.00 | 1.00 | google_system_design | google_system_design, apple_system_design, google_algorithms |
| `goo-beh-1` | natural | 1 | 1.00 | 1.00 | google_behavioral_ambiguity, google_behavioral | google_behavioral, google_behavioral_ambiguity, google_algorithms |
| `goo-cs-2` | natural | 1 | 1.00 | 1.00 | google_core_cs_networking_deep | google_core_cs_networking_deep, batch::meta_eng::d2835f9807e2ac5c50126ae8a28ea50b |
| `met-cod-2` | natural | 1 | 1.00 | 1.00 | meta_coding_graph_social | meta_coding_graph_social, batch::netflix_tech::690793a27e30486963070a66d0c60d04 |
| `met-sd-1` | natural | 1 | 1.00 | 1.00 | meta_system_design_realtime | meta_system_design_realtime, fundamentals_observability, batch::cloudflare_blog::1e45d1b10f1436637f72d64d244e4954 |
| `met-beh-1` | natural | 1 | 1.00 | 1.00 | meta_behavioral_shipping, meta_behavioral | meta_behavioral_shipping, meta_behavioral, batch::meta_eng::d2835f9807e2ac5c50126ae8a28ea50b |
| `app-beh-1` | natural | 1 | 1.00 | 1.00 | apple_behavioral_quality_bar, apple_behavioral | apple_behavioral, apple_behavioral_quality_bar, apple_system_design |
| `fun-sd-1` | natural | 1 | 1.00 | 1.00 | fundamentals_database_sharding | fundamentals_database_sharding, batch::meta_eng::61f1aa6da8d63daf439966b5f861c913, batch::netflix_tech::690793a27e30486963070a66d0c60d04 |
| `fun-sd-2` | natural | 1 | 1.00 | 1.00 | fundamentals_caching_strategies | fundamentals_caching_strategies, batch::netflix_tech::690793a27e30486963070a66d0c60d04, batch::meta_eng::61f1aa6da8d63daf439966b5f861c913 |
| `fun-sd-3` | natural | 1 | 1.00 | 1.00 | fundamentals_message_queues | fundamentals_message_queues, batch::meta_eng::61f1aa6da8d63daf439966b5f861c913, batch::meta_eng::d2835f9807e2ac5c50126ae8a28ea50b |
| `fun-sd-4` | natural | 1 | 1.00 | 1.00 | fundamentals_rest_api_design | fundamentals_rest_api_design, fundamentals_security_interview, batch::aws_arch::455c459d9a3063bc0e3d01a4bf30675f |
| `fun-sd-5` | natural | 1 | 1.00 | 1.00 | fundamentals_observability | fundamentals_observability, batch::microsoft_devblog::66e762c52b4fb40c0d9e6b7d96ab914f, batch::aws_arch::b13ae8eb66af70e2227ed3dee9d88f13 |
| `blog-flink` | natural | 1 | 1.00 | 1.00 | batch::netflix_tech::d541eecfda7d0718264dbf08019c1b3f | batch::netflix_tech::d541eecfda7d0718264dbf08019c1b3f |
| `blog-graph` | natural | 1 | 1.00 | 1.00 | batch::netflix_tech::690793a27e30486963070a66d0c60d04 | batch::netflix_tech::690793a27e30486963070a66d0c60d04 |
| `blog-zstd` | natural | 1 | 1.00 | 1.00 | batch::cloudflare_blog::3358acf7c004013790a780c46c93c215 | batch::cloudflare_blog::3358acf7c004013790a780c46c93c215 |
| `blog-rdma` | natural | 1 | 1.00 | 1.00 | batch::meta_eng::d2835f9807e2ac5c50126ae8a28ea50b | batch::meta_eng::d2835f9807e2ac5c50126ae8a28ea50b |
| `blog-mtia` | natural | 1 | 1.00 | 1.00 | batch::meta_eng::e10619a31890878acd7ca80c9ca7f63b | batch::meta_eng::e10619a31890878acd7ca80c9ca7f63b |
| `blog-zgw` | natural | 1 | 1.00 | 1.00 | batch::meta_eng::61f1aa6da8d63daf439966b5f861c913 | batch::meta_eng::61f1aa6da8d63daf439966b5f861c913, batch::cloudflare_blog::3358acf7c004013790a780c46c93c215 |
| `blog-evals` | natural | 1 | 1.00 | 1.00 | batch::airbnb_eng::ca6079ed8c27b1cd2015464e8f96795b | batch::airbnb_eng::ca6079ed8c27b1cd2015464e8f96795b, batch::aws_arch::31b763fcbea2ec8604476a72f73ba24a, batch::brendangregg::f3643b8e8910c4f1fde68a6fae86ec66 |
| `blog-dspy` | natural | 1 | 1.00 | 1.00 | batch::dropbox_tech::f972b7da95a7c6f07fabce6227c0ed50 | batch::dropbox_tech::f972b7da95a7c6f07fabce6227c0ed50 |
| `blog-authn` | natural | 1 | 1.00 | 1.00 | batch::airbnb_eng::80289671873347c21f0b99f464d0cd1b | batch::airbnb_eng::80289671873347c21f0b99f464d0cd1b |
| `blog-mcp` | natural | 1 | 1.00 | 1.00 | batch::aws_arch::455c459d9a3063bc0e3d01a4bf30675f | batch::aws_arch::455c459d9a3063bc0e3d01a4bf30675f |
| `blog-isabelle` | natural | 1 | 1.00 | 1.00 | batch::martin_kleppmann::60c4c6ce63ff92802b9f6db3a1235883 | batch::martin_kleppmann::60c4c6ce63ff92802b9f6db3a1235883 |
| `blog-riviera` | natural | 1 | 1.00 | 1.00 | batch::dropbox_tech::1f9b3059a0a1b2a43f28371371c19b26 | batch::dropbox_tech::1f9b3059a0a1b2a43f28371371c19b26, batch::netflix_tech::f2cea8ea3788bfa85203e257c718e7ae |
