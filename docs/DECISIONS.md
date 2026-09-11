# Decisions & Findings

A running log. Newest first. Append entries as work happens — don't rewrite old ones;
if a decision is reversed, add a new entry that supersedes it and link back.

Entry format: date, what was decided, why, and what it means going forward.

---

## 2026-09-10

### D-039 — Resume isolation is three layers, and deletion drops the namespace
**Shipped Phase 5:** resume upload → parse → per-user vector namespace → blended
retrieval → grounded question generation.

**Isolation is defended three independent ways**, because the failure mode is one
candidate's resume surfacing in another's interview -- a data breach, not a wrong answer:
1. **Physical namespace.** Each user's chunks live in their own Chroma collection,
   `resume_<sha256(user_id)[:32]>`. A query against one collection cannot return another
   user's chunk however wrong the filter is. The id is hashed because collection names are
   visible in admin tooling.
2. **Metadata filter.** Every chunk still carries `user_id` and every query still passes
   `where={"user_id": {"$eq": ...}}` -- redundant on purpose, since this is the layer that
   catches a namespacing bug.
3. **Egress check.** Every hit is verified against the requesting user before return; a
   mismatch is dropped, logged and counted in `ISOLATION_VIOLATIONS`, surfaced at
   `GET /metrics/llm`. Fails closed and is observable.
Each layer is mutation-tested separately: collapsing the namespace fails 7 tests, removing
the `where` filter fails 1, disabling the egress check fails 1. A suite that only exercises
all three together could not tell you two of them had stopped working.

**Deletion drops the collection rather than emptying it.** An empty collection still named
after the user discloses that they once had a resume. `DELETE` re-reads after purging and
500s if anything remains, so "deleted" is verified rather than claimed.

**A separate `resume_grounded_question_chain`, not a flag on the existing one.**
`structured_question_chain` is covered by the Phase 1 prompt snapshots and is what the
retrieval evaluation measures; editing its prompt for a feature only some sessions use
would invalidate both. The new chain emits `groundedIn` -- the resume detail used, copied
verbatim -- which is what makes "references real resume content" checkable rather than
eyeballed. Company and resume context stay in **separate labelled prompt blocks**: merged,
the model attributes the company's engineering blog to the candidate.
**Grounding follows the retrieved chunks, not the request flag.** A user who asks for
grounding but has no resume gets the ordinary chain, never a prompt instructed to cite a
resume it cannot see.

### D-040 — Three defects the unit tests could not see, found by running it for real
All three were found by `scripts/verify_resume_isolation.py` against the live stack, and
all three had green unit tests over the same code.

**1. A rejected upload destroyed the resume the user already had.** The first ordering was
upsert-the-row → ingest → roll back on failure, and the rollback deleted the row *and*
purged the namespace. So uploading a scanned PDF wiped a perfectly good existing resume.
Now nothing is mutated until ingestion succeeds: the row id is reused when one exists (so
it stays stable across re-uploads) and the insert happens only after the AI service returns.
**A rejected upload is now a no-op.**

**2. A provider outage mid-re-upload lost the old resume.** `ResumeStore.ingest` purged
before embedding, so the step that actually fails -- reaching the embedding provider --
happened after the old data was gone. **Embedding now happens first**; the namespace is
only replaced once there is something to replace it with. The destructive rollback in the
ai-service handler was removed for the same reason.

**3. Reading created what it was asked about, and deletion resurrected itself.**
Read paths used `get_or_create_collection`, so merely asking whether a user had a resume
materialised an empty collection named after them -- and the `DELETE` handler's verifying
read-back **re-created the collection it had just dropped**. Deletion reported success
while the namespace survived. Read paths now use a non-creating lookup that returns `None`.
Caught only because the end-to-end run audits Chroma's collection list directly; the fake
modelled `get_or_create` for both paths, so the unit tests were structurally blind to it.
The fake now models the two lookups distinctly.

**Verified against the live stack: 34/34 checks pass** -- two users ingested with one
namespace each, neither able to retrieve the other's chunks (asserted by content markers in
both directions), zero isolation violations, deletion purging every vector *confirmed by
direct Chroma query*, user B untouched, all five malformed-PDF classes returning actionable
4xx rather than a crash, and a generated question quoting the candidate's real resume
("HIPAA-compliant patient messaging app... offline-first sync", `groundedIn` populated).

**Not done:** there is no web UI for upload or deletion -- the feature is exercised through
the API and the verification script. The exit criteria are isolation and deletion, not a
clickable demo, so this is recorded rather than rushed.

### D-038 — The Phase 4 live path was never wired in, and its gate was calibrated for the wrong metric
**Found while starting Phase 5:** `retrieve_with_live_fallback` — the read-through
write-back cache that is Phase 4's headline mechanism (D-009) — was referenced **only by its
own tests**. `app/api/interview.py` called plain `retrieve_company_context`, so in the running
system the confidence gate never ran, no live fetch ever fired, and nothing was ever written
back. Phase 4's exit criterion "hybrid path verified in both directions" was met by unit tests
calling the function directly, which is exactly the class of check that cannot see this.
**Fixed:** `next-question` now calls the hybrid path, and forwards `user_id` and `session_id`
so the per-user and per-session fetch caps are actually enforceable (they were unreachable
before, since nothing supplied the ids). The backend mints the session UUID up front rather
than letting the database default it — the question is generated before the row is inserted,
so without a client-minted id there is no session key to bound spend with. Generating first
and inserting after is kept deliberately: a failed generation leaves no orphan session.

**Then the gate turned out to be miscalibrated, which the wiring exposed immediately.**
Measured across all 40 company/stage pairs, only **3 of 40** passed the confidence check — so
wiring the path in as-found would have sent ~93% of questions down the expensive live path.
That is the "too eager" failure mode `confidence.py`'s own docstring warns about.
**Root cause is a metric mismatch, not a bad threshold.** The collection uses Chroma's default
`l2` space, and on unit-normalised embeddings that returns *squared* euclidean distance, which
is exactly `2 * (1 - cosine_similarity)` — verified against hand-computed dot products
(`chroma_d=0.5796` vs `2*(1-0.7102)=0.5796`), not assumed. The thresholds were written for a
`[0, 2]` cosine-distance scale, so **every one was a factor of two too strict**.
**Recalibrated against the corpus rather than doubled by arithmetic.**
`app/eval/calibrate_confidence.py` sweeps the grid using a non-circular label — the 4
hand-seeded companies must not fetch, the 6 thin Phase 4 starters should — and optimises
perfect recall on covered pairs first, since a needless fetch costs money, latency *and*
unvetted corpus content. Operating point: `MAX_TOP_DISTANCE 0.62 → 0.78`,
`MAX_GOOD_DISTANCE 0.75 → 0.85`, `MIN_GOOD_HITS 2 → 1`.
**Result: 16/16 well-covered pairs now pass (zero needless fetches) and 24/24 thin pairs
trigger the live path** — 18 on distance, 6 because the company+stage filter matched nothing
and the corpus-wide fallback returned other companies' chunks (`company_matched=False`).
Perfect separation, and each half has an explained mechanism.
**`MIN_GOOD_HITS` dropped to 1 on evidence:** the company+stage filter often returns only 2–3
hits from a 721-chunk corpus, so demanding two usable ones cut covered-pair recall to 56–69%.
`test_single_good_hit_is_not_enough` encoded the old value and was rewritten to exercise the
floor mechanism with the number monkeypatched, so the tuned value lives in exactly one place.
**Regression-proofed at the level the bug lived at.** The new tests drive the HTTP endpoint,
because a unit test that calls the function directly can never answer "is this connected to
anything". Confirmed by mutation: reverting `next-question` to plain retrieval fails exactly
3 of them, and restoring it passes all 6.
**Not fixed, and worth stating:** live *discovery* currently returns nothing — the Gemini free
tier is returning 429 RESOURCE_EXHAUSTED for search-grounded calls (consistent with D-037's
capacity finding). The path degrades safely (`"discovery returned no candidates"`, no
exception, interview unaffected), but write-back cannot be demonstrated end to end until
quota is available. The gate and the wiring are verifiable today; the fetch half is not.

## 2026-09-09

### D-034 — Per-user LLM rate limits (closes F-04)
**Decided:** a second, much tighter limiter (`llmLimiter`, 40 req/15min) applied only to the
routes that reach a provider — interview create/answer/report, speech, system-design
analysis, code review, recommendations — on top of the existing global 500/15min.
**Why two limits:** 500 requests in a window is generous for reading problems and ruinous
for code review. Before this, one user could exhaust the entire provider quota for
everyone, on the owner's own API key.
**Keyed on user, not IP.** An IP bucket is the wrong unit: everyone behind one NAT shares
it, while one user on mobile gets a fresh bucket per reconnect. Anonymous requests fall
back to `ipKeyGenerator`, not raw `req.ip`, because raw IPv6 handling would give every
address in a /64 its own bucket — free to bypass.

### D-035 — Correlation IDs across services
**Decided:** every request gets an `x-request-id` (reusing an inbound one when present),
stored per-request and propagated on outbound calls to ai-service, which adopts it into a
ContextVar so it reaches every chain without threading through signatures.
**Why:** one user action fans out across four services. Without a shared id their logs
cannot be joined, and debugging "the interview failed" means guessing which of three
ai-service log lines belongs to the request.
**Inbound ids are length-bounded** — a client-supplied header ends up in logs and in
downstream requests.

### D-036 — LLM cost and latency accounting, and the path it initially missed
**Added:** `app/core/observability.py` records model, provider, chain, duration, token
estimates and cost per call, exposed at `GET /metrics/llm`. `chain_name` defaults to the
factory's `__name__`, so every existing call site got per-chain attribution without being
touched.
**Bug caught by using it:** the first version reported `calls: 0` during a real evaluation
run. The reranker calls `_get_llm()` directly rather than through `invoke_with_fallback`
(it needs its own timeout and must never fail the request), so the single highest-volume
LLM path was invisible to cost accounting. Now instrumented explicitly.
**Measured:** question generation ≈ **$0.000071/call**; reranking ≈ **$0.000194/call** —
2.7x more, because it ships 20 candidate excerpts per request. Token counts are estimated
from character length (~4 chars/token) since LangChain does not surface usage metadata
uniformly; this is for order-of-magnitude cost, not billing.

### D-037 — Gemini model upgrade evaluated and declined, for a capacity reason
**Question:** should the primary model move from `gemini-3.1-flash-lite-preview` to a
newer one? (`gemini-3.6-flash` was suggested; `3.7` and `3.8` also exist.)
**Measured** with the retrieval harness, provider pinned to Gemini so a 429 could not
silently fail over to GPT-4o-mini and be labelled as a Gemini result:

| model | nDCG | MRR | 429s |
|---|---|---|---|
| `gemini-3.1-flash-lite-preview` | 0.8988 | 0.9167 | none |
| `gemini-3.8-flash` | 0.8860 | 0.9008 | ~20 retries |

**Conclusion: stay on the lite model, but not because it scored higher.** The −0.0128 delta
is inside the ±0.024 noise band, so on quality the two are indistinguishable — and the
3.8-flash run is not even a clean measurement, since rate-limited reranker calls hit the 5s
timeout and fell back to first-stage ranking. Its *lower* wall time is the tell.
**The decisive finding is capacity, not quality.** On the free tier the newer flash models
report `limit: 20` (sometimes 5) requests/minute, while the reranker alone issues ~20 calls
per evaluation. The lite model sustains that rate; the newer ones cannot.
**Revisit if** the project moves to a paid tier, where the RPM ceiling disappears and the
comparison becomes a fair quality question again.

## 2026-09-08

### D-032 — Sandbox hardened; ReadonlyRootfs deliberately excluded (closes F-03)
**Applied:** containers run as the image's unprivileged `runner` user (the previous
`User: "root"` override made every other restriction moot), plus `CapDrop: ["ALL"]`,
`SecurityOpt: ["no-new-privileges"]`, `PidsLimit: 128`, `NanoCpus: 1e9`, and a
size-bounded tmpfs at `/tmp`.
**`ReadonlyRootfs` is NOT set, and that is a decision rather than an oversight.** Docker's
archive API refuses to write into a container whose rootfs is read-only — both before start
and, tested, after it — so user code cannot be injected at all. The alternatives are env
vars (bounded by `ARG_MAX`) or an exec with attached stdin, and neither earns its
complexity here: the container is ephemeral, unprivileged and network-disabled, so a write
to its filesystem is discarded seconds later. The tmpfs is what actually bounds disk usage.
**Trap found the hard way:** Docker mounts tmpfs `noexec` by default. C and C++ compiled
fine and then failed with `/tmp/sol: Permission denied` at run time — a change that looks
like a hardening win right until half the languages stop working. `exec` is now explicit
and asserted in a test.
**Verified adversarially, with before/after proof:** writing to `/etc/passwd` **succeeded**
under the old root config and is blocked under the new one; `PidsLimit` cut forking at
exactly 127 children; networking is unreachable. All four languages still pass.
**Regression-proofed:** the container config is extracted into `buildContainerConfig()` and
asserted by tests naming the attack each flag prevents — these restrictions are invisible to
functional tests, so without them, silently dropping a flag would pass CI. Confirmed by
mutation: re-adding `User: "root"` and switching the tmpfs to `noexec` each fail exactly one
test.

### D-033 — memoryKb is sampled and approximate, not exact (closes F-05)
**Decided:** peak memory is sampled by polling container stats during execution and keeping
the maximum, with page cache subtracted the way `docker stats` does it.
**Why approximate:** cgroup v2 does not expose `memory_stats.max_usage` through the Docker
API, so a true high-water mark is not obtainable — only instantaneous `usage`. A spike
shorter than the sample interval can be missed, and runs shorter than roughly one interval
report nothing at all rather than a wrong number.
**Measured:** a 60 MB allocation reports 71.7 MB (the balance is interpreter overhead); a
93 ms run reports nothing, which is the documented limitation rather than a bug.
**No backend change needed:** `submission.routes.ts` already persisted
`runResult.memoryKb`; the column was null only because code-runner never sent it.

### D-031 — F-14 closed: web lint fixed properly and made blocking
**Decided:** the four `react-hooks` errors are fixed at the source, not suppressed, and CI
lint is now **blocking** rather than `continue-on-error`.
**How each was fixed:**
- `theme-provider.tsx` — the stored theme is external state, so it is read with
  `useSyncExternalStore` instead of copied into React state in a mount effect. Removes a
  cascading render (and the theme flash) on every page load, and adds cross-tab sync.
  `mounted` uses the same mechanism (`() => true` client, `() => false` server).
- `problems/[id]` — the reset-on-prop-change effect was deleted. The call site already had
  `key={problem.id}`, which is React's documented way to reset state on prop change, so the
  effect was redundant.
- `paths/[slug]` — `setNotFound(false)` moved out of the synchronous effect body into the
  promise callbacks.
- `dashboard` — `Date.now()` during render replaced with a `useNow()` hook built on
  `useSyncExternalStore`, bucketed to the minute so the snapshot is stable within a render.
  Fixing that surfaced a second, previously masked error in the same file
  (`setRecsLoading(true)` in the mount effect), fixed by initialising the state to `true`.
- `avatar.tsx` — the `<img>` warning is disabled with a reason rather than "fixed":
  avatars are stored as **base64 data URIs**, which `next/image` cannot optimise, and
  configuring `remotePatterns` for user-supplied URLs would turn the server into an open
  image proxy. A plain `<img>` is the correct element.
**Verified at runtime, not just compiled:** the app was started and the login, home,
register and problems routes all return 200 with no hydration errors.

### D-031b — Host ports offset to coexist with another local project
**Finding:** this machine runs a separate RA project (`g2aging`) on ports 3000, 8000 and
5432. `interviewforge-web` had been silently failing to start on the 3000 conflict.
**Caught by accident, worth recording:** the readiness check polled
`http://localhost:3000` and got a 200 — from the *other project's* web container — so it
reported success while our container was not running at all. A readiness probe that does
not assert *which* application answered is not a readiness probe.
**Decided:** InterviewForge's host bindings are offset — web **3001**, ai-service **8010**,
postgres **5433**. The other project's ports are left exactly as they are; it is not ours
to move. Container ports are unchanged, so service-to-service traffic is unaffected.

### D-030 — Merged to main; the work is now the default branch
**Decided:** `feat/platform-v2` merged to `main` via PR #1 (merge commit `f36b675`), with a
**merge commit rather than a squash**.
**Why the merge commit:** the nine commit messages carry the reasoning for each phase.
Squashing would collapse them into one line and discard the most useful part of the history.
**Why this mattered enough to prioritise over Phase 5:** `main` was 8 commits behind and its
HEAD was the iOS commit, so anyone opening the public repo saw the pre-everything version —
4 companies, no evaluation, no retrieval work. Five phases of engineering existed only on a
side branch. Making finished work visible beat adding more invisible work.
**Also landed:** README rewritten to lead with the measured result (nDCG 0.771 → 0.901) and
to state plainly that two techniques were measured and reverted; CI actions bumped off the
deprecated Node 20 runners; the plan's progress table corrected — the SHAs recorded there
had been captured *before* `git commit --amend` and pointed at orphaned pre-amend objects.
**CI verified green** on all four jobs after the merge push.

## 2026-09-05

### D-025 — Reranking is an LLM call, not a cross-encoder, because of the prod memory cap
**Decided:** second-stage reranking is implemented as a single LLM call over the candidate
set, not a local cross-encoder.
**Why:** `docker-compose.prod.yml` caps ai-service at `mem_limit: 300m`. sentence-transformers
pulls torch plus a resident model far past that ceiling, so a local cross-encoder is
architecturally incompatible with the current production sizing. The LLM path adds no
dependency and no resident memory, and reuses the existing provider fallback.
**Trade-off recorded, not hidden:** a cross-encoder would be faster per query and free at
inference time. `strategy="cross_encoder"` is the slot to fill if the memory ceiling is
ever raised.
**Biggest single lever in the phase:** nDCG 0.8321 → 0.9465 uncapped.

### D-026 — The reranker is capped at 5s, and the first attempt at capping it made things worse
**Finding:** uncapped reranking had p50 905ms but a **10.1s worst case**, which would stall
an interview mid-question.
**Bug worth remembering:** the first timeout implementation wrapped the call in
`with ThreadPoolExecutor(...)`. `__exit__` calls `shutdown(wait=True)`, so every timed-out
call was then waited on anyway — measured p50 976ms but max **20.7s**, i.e. the "fix" made
the tail twice as bad. Corrected with a module-level pool that is never awaited, so the
future is genuinely abandoned. There is a regression test asserting elapsed < 2s when the
underlying call sleeps 5s.
**Timeout chosen: 5s.** Quality is monotonic in the timeout (3s → 0.8959, 5s → 0.9028,
8s → 0.9208, none → 0.9465), but 8s beats 5s by 0.018, inside the ±0.024 noise band — so
three extra seconds of worst case buys nothing measurable.

### D-027 — Stacking retrieval techniques is not additive; route instead
**Finding:** `hybrid + rerank` (nDCG 0.9232) scored **lower** than rerank alone (0.9465),
with identical precision and hit_rate — the two find the same documents and differ only in
ordering. They are substitutes: both fix first-stage ranking errors, and applying RRF first
perturbs the candidate order the reranker then works from.
**Second occurrence of this pattern** — contextual retrieval and structural chunking were
substitutes in Phase 2 (D-020). **Stacking individually-good retrieval techniques must
always be measured, never assumed.**
**Decided:** ship per-stage routing instead of a global stack. Behavioural and system design
route to the reranker (discursive, semantic); coding and core CS route to hybrid+BM25
(named algorithms, precise terminology like RDMA or false sharing). Unknown stages fall
back to the reranker.
**Result:** nDCG 0.9009 vs 0.9028 for reranking everywhere — equal within noise — at
**6.6x lower p50 latency** (268ms vs 1762ms), because half the questions never pay for an
LLM call.

### D-028 — MMR reverted: the harness cannot measure what it is for
**Decided:** MMR stays implemented but off (`MMR_ENABLED=false`). Measured −0.013 nDCG:
inside the noise band, but consistently negative.
**Why it cannot be judged here:** MMR deliberately trades relevance for diversity, and every
metric in the harness rewards relevance only. A technique that demotes a
relevant-but-redundant chunk can only score worse on these instruments. Judging it needs a
redundancy metric — how much do the k returned chunks overlap — which does not exist yet.
**Pattern worth noting:** this is the third technique across Phases 2 and 3 that ranking
metrics structurally cannot see (small-to-big, MMR, and partly routing). A harness measures
one thing; reaching for it to score something it cannot see returns a confident number that
is easy to misread as a result.

### D-029 — Noise band widened to ±0.024 after observing restart-induced variance
**Finding:** the post-Phase-2 index measured nDCG 0.8083 immediately after its rebuild and
0.8321 after a later container restart — same content, same 721 chunks. Evaluation against
a fixed index remains bit-identical (verified four times, including across a Chroma
restart); it is index *construction and reload* that varies.
**Consequence:** the noise band from D-022 is widened from ±0.02 to **±0.024**, and Phase 3
used the stable 0.8321 as its reference. Phase 2's conclusion is unaffected — the character
baseline was 0.7712, below every structural draw.

### D-024 — Postgres host port moved to 5433
**Decided:** `docker-compose.yml` binds Postgres to host **5433**, not 5432.
**Why:** another project on the same machine holds 5432 and cannot release it, so the
container failed to start with "port is already allocated".
**Why it is safe:** the host binding exists only for tools run from the host (psql, GUI
clients). Every service reaches Postgres over the compose network as `postgres:5432`, so
`backend/.env` and `docker-compose.prod.yml` are unchanged — prod does not publish the
port at all, since it uses RDS.
**Connect from the host with** `psql -h localhost -p 5433 -U postgres -d interviewforge`.
Commands in this repo use `docker compose exec postgres psql ...`, which is unaffected.

### D-020 — Structural chunking kept; contextual retrieval reverted as a net loss
**Kept — structural chunking.** Split on markdown headings, then paragraphs, falling back
to character splitting only inside an oversized section, merging sub-floor sections into
their neighbour. Improved every metric (nDCG 0.771 → 0.826, hit_rate 0.833 → 0.905).
It matters now and would not have before Phase 4: the seed corpus was 34 single-idea
documents where character splitting was harmless; ingested articles are 10-30k characters
spanning several topics.
**Reverted — contextual retrieval.** Prepending an LLM-written situating sentence per
chunk made retrieval *worse* on every metric (nDCG -0.061, hit_rate -0.071,
precision_norm -0.083), well outside the noise band.
**Why it lost, which is the interesting part:** it is partly a substitute for structural
chunking, not a complement. Contextual retrieval exists to restore context that chunking
destroyed — but structural chunking already keeps each section with its heading, so the
situating information is mostly present. The generated sentence then adds near-boilerplate
phrasing that dilutes distinctive terms and makes sibling chunks from one document look
*more* alike. Published wins for the technique are measured against naive fixed-size
chunking, which is the baseline it repairs.
**Kept behind `CONTEXTUAL_RETRIEVAL=false`** rather than deleted — worth re-testing if the
corpus ever contains long unstructured documents without headings.

### D-021 — Small-to-big cannot be scored by the retrieval harness, so it was scored differently
**Finding:** small-to-big changes the text handed to the LLM, not the ranking. Measured
delta on every retrieval metric was exactly 0.0000, as predicted before running it.
**Decided:** measured with an LLM-judged context-sufficiency rubric instead. Window 1
scored 4.50 vs 3.38 at window 0, at 2.06x context. **Window 2 scored *lower* (4.00) on 28%
more text** — context dilution, not a monotonic win. Window 1 shipped.
**Caveat recorded:** sample of 8 queries, single judge pass; direction is clear, magnitude
is not tightly bounded.
**General lesson:** a harness measures one thing. Reaching for it to score a technique it
structurally cannot see produces a confident zero, which is easy to misread as "no effect"
rather than "wrong instrument".

### D-022 — Index rebuilds are nondeterministic; evaluation is not
**Finding:** repeated eval runs against one index are bit-identical (three runs, all nDCG
0.8083). Rebuilding the index from the *same* cached documents is not: two structural
rebuilds scored 0.8263 and 0.8083, an 0.018 spread, from nondeterminism in Chroma's HNSW
construction.
**Consequence:** a single-rebuild difference below roughly ±0.02 is not evidence. Both
Phase 2 conclusions sit outside that band, but the structural gain is nearer to it than
the headline numbers suggest. Future phases that rebuild the index should either average
several rebuilds or restrict claims to effects larger than the noise floor.

### D-023 — A corpus cache makes chunking comparisons honest
**Decided:** `app/ingest/reindex.py` snapshots the full extracted text of every ingested
document to disk, and rebuilds Chroma from that cache.
**Why:** comparing chunking strategies requires re-chunking *identical* source documents.
Chroma stores chunks, not originals, and re-fetching from feeds returns a different article
set, which would silently turn a chunking comparison into a corpus comparison.
**Detail worth keeping:** 6 of 50 documents could no longer be re-fetched (Medium rejects
the canonicalised URL for some articles), and 3 of those are referenced by golden queries.
Rather than let them vanish and measure corpus loss as if it were a chunking effect, they
are reconstructed from their stored chunks by detecting and removing the overlap region.

## 2026-09-04

### D-015 — Corpus size does not create benchmark difficulty; topical overlap does
**Finding:** batch-ingesting 13 engineering blogs took the corpus from 36 to 609 chunks
(17x) and the metrics barely moved — nDCG 0.987 → 0.975. Adding **12 golden queries whose
answers live in the ingested content** moved them properly: nDCG 0.813, MRR 0.829,
hit_rate 0.857.
**Why:** the new content was topically orthogonal to the existing golden queries, so it
never competed with the labelled answers. Difficulty comes from near-collisions — AWS and
Microsoft both publishing on MCP servers, Airbnb and Dropbox both on GenAI evaluation,
Kleppmann with two formal-verification pieces — not from row count.
**Consequence:** `docs/eval/phase4-baseline.md` supersedes `baseline.md` and is what
Phases 2 and 3 are measured against. There is now real headroom: 14% of queries miss
entirely (hybrid/BM25 has recall to recover) and MRR 0.829 means the right document is
often retrieved but mis-ranked (reranking has something to fix).

### D-016 — Embeddings moved to OpenAI for a throughput reason, not a quality one
**Decided:** `EMBEDDING_PROVIDER=openai` (`text-embedding-3-small`, 1536-dim).
**Why:** Gemini's `embed_content` accepts one text per call and the free tier allows 100
requests/minute, so ingesting a few hundred chunks is impossible without heavy throttling —
it failed with 429 partway through the first real batch run. OpenAI accepts up to 128
inputs per request. This is an operational constraint, not a benchmark claim: on quality
`gemini-embedding-001` is the stronger model, but it cannot be used for bulk ingestion on
this tier.
**Also rewrote `EmbeddingService`** to close F-16: batching for OpenAI, retry with backoff
honouring the server's `retry in Ns` hint for Gemini, and whole-call provider fallback.
Fallback is per-call, never per-batch, because vectors from two providers have different
dimensionality and must not share a collection.
**Cost of the switch:** a full re-index. Done while the corpus was still ~100 chunks;
deferring it would have made it far more expensive.

### D-017 — Document identity is the canonical URL, not the fetched URL
**Finding:** re-running batch ingestion grew the corpus instead of being idempotent.
Medium appends a random `?gi=` token on every redirect, so the same article resolved to a
different URL each fetch, hashed to a different source id, and was stored again. Two
Netflix articles were duplicated this way.
**Decided:** source ids derive from a canonical URL — tracking parameters (`gi`, `source`,
`utm_*`, `fbclid`, …) stripped, fragment dropped, host lower-cased, trailing slash
normalised. Ingestion also skips URLs whose source id is already stored, with `--force` to
re-ingest deliberately.
**Verified:** four consecutive batch runs; runs 3 and 4 both reported
`already_have=4, pages=0` with the chunk count frozen at 680. The growth seen on run 2 was
a transient fetch failure converging, not a logic defect.
**Note:** SimHash near-duplicate detection did not catch this because the index is
per-run; these duplicates arrived in *different* runs.

### D-018 — Company expansion to 10, and the backend list is now a cross-service contract
**Decided:** added Microsoft, Uber, Bloomberg, Adobe, LinkedIn and Airbnb profiles.
Microsoft first because it already had 38 tagged problems and no interview profile (F-13).
**Cross-service risk found:** `backend/src/services/interview-state.service.ts` hard-codes
its own `COMPANIES` list. A company accepted by the backend but missing a profile in
`company_profiles.py` produces a 500 at question-generation time. The lists are now synced
and a test asserts the length, but this is exactly the drift F-09 describes and the real
fix is the generated contract.
**F-11 closed:** the Facebook/Meta duplicate tag was fixed in `leetcode_problems.json` and
in the live database (3 problems; Meta now 15).

### D-019 — Source tiering is by domain, which cannot split free from paid content
**Decided:** three tiers. Tier 1 (company engineering blogs, openly licensed material) and
Tier 2 (individual engineering blogs) are ingested with attribution and `robots.txt`
respected. Tier 3 — LeetCode, NeetCode, Striver/takeUforward, YouTube — is **never
ingested** and is used only as curriculum taxonomy (which topics matter, in what order),
which is factual structure rather than their prose.
**Conflict a test caught:** `takeuforward.org` was initially in both Tier 2 (free articles)
and Tier 3 (paid course). Since `is_allowed` checks the blocklist first, the Tier 2 entry
was dead code. Domain-level tiering cannot separate free from paid content on a shared
domain, so the whole domain is Tier 3.
**Uber and LinkedIn** no longer publish working public feeds (both 404). They stay on the
allowlist so the live path can use them; they contribute nothing to batch ingestion.

### D-012 — Benchmark is saturated; Phase 4 must move before Phases 2 and 3
**Finding:** the Phase 1 baseline scores hit_rate 1.000, MRR 1.000, nDCG 0.987 and
normalised precision 0.983 — with *and* without the metadata filter. Retrieval sits at
~98% of the achievable ceiling.
**Why:** 34 documents across 16 well-separated company × stage topics means nearly every
query has one obviously-correct document and no competitors. Dense embeddings win
trivially. The benchmark measures the corpus, not the retriever.
**Consequence:** Phases 2 (index-side) and 3 (query-side) **cannot show measurable
improvement** here. ~1.3% nDCG headroom is below the noise floor. Reranking, hybrid
search and semantic chunking all target failure modes this corpus does not exhibit.
**Decided:** reorder — run **Phase 4 (corpus expansion + hybrid ingestion) before
Phases 2 and 3**, then re-baseline on the larger corpus and only then measure retrieval
techniques. This reverses the sequencing constraint in D-009, which assumed the corpus was
adequate and only worried about company changes shifting the baseline. The deeper problem
is that a 34-document corpus cannot support retrieval benchmarking at all.
**Kept:** the index-side/query-side split from D-009 still holds; only the order relative
to Phase 4 changes.

### D-013 — Embedding provider switched to Gemini; OpenAI model config was stale
**Finding:** `text-embedding-004` (the configured Gemini default) returns 404 — retired.
The OpenAI key in `ai-service/.env` was also returning 401 at the time.
**Decided:** default `EMBEDDING_PROVIDER` is now `gemini` and `GEMINI_EMBEDDING_MODEL` is
`gemini-embedding-001` (3072-dim, verified working). The Chroma collection was dropped and
rebuilt, because changing embedding model changes vector dimensionality and a collection
cannot hold both.
**Note:** the OpenAI key was later replaced and now works for both embeddings and chat, so
provider fallback is functional again. Embeddings stay on Gemini — flipping back would
require another full re-index for no measured benefit.
**Operational gotcha recorded:** `docker compose restart` does **not** reload `env_file`;
only `up -d --force-recreate` does. Cost ~20 minutes of false diagnosis.

### D-014 — Judge calibration is asserted as ordering, not absolute scores
**Decided:** the monotonicity check asserts weak < mediocre < strong for the same question,
plus a minimum weak-to-strong spread of 3 points. It does not assert that a strong answer
scores 8.
**Why:** absolute scores drift with prompt and model changes and would make the test
brittle for no benefit. The ordinal claim is the one that must hold — if it breaks, the
scoring is not measuring quality.
**Found a real fixture bug on the first run:** the judge scored the "weak" and "mediocre"
Amazon behavioural answers identically (3 and 3). On inspection the judge was right and the
fixture was wrong — the mediocre answer had the candidate handing the problem to the owning
team, which fails the *ownership* competency being tested, so it was not mid-tier at all.
Rewritten; now 3 / 6 / 9.
**CI:** live runs record responses to `app/eval/fixtures/monotonicity.json`; CI replays them,
so the ordering assertion runs on every push with no API spend.

## 2026-09-03

### D-011 — Phase 0 complete: 143 tests across three services
**Decided:** Vitest for `backend/` and `code-runner/`, pytest for `ai-service/`, and a
GitHub Actions matrix running lint → test → build on every push.
**Why these targets:** the first tests went to pure-logic, high-consequence code —
`compareOutputs` (decides whether every submission passes), the interview stage machine,
UUID validation (the input-validation boundary), and password/JWT handling. No route
handler tests yet: those need a database and belong with the repository layer refactor.
**Verified by mutation, not by passing:** each suite was proven to *fail* when the code
under it was deliberately broken — float tolerance 1e-4 → 1e-12 caught by code-runner,
the one-follow-up-per-stage rule caught by backend, and the RAG unfiltered-retry fallback
caught by ai-service. A test that cannot fail is not a test.
**Two real defects found and fixed:** test files were compiling into `backend/dist` and
`code-runner/dist`, which would have shipped test code (and a `vitest` import) into
production builds. `tsconfig.json` now excludes them.
**Kept prod lean:** pytest went into a new `requirements-dev.txt` used only by the dev
Dockerfile; `Dockerfile.prod` still installs `requirements.txt` alone.
**Honest gap:** `web/` lint is `continue-on-error` because of 4 pre-existing react-hooks
errors (F-14). Refactoring working UI did not belong in the commit that establishes CI,
but the failures are visible in CI output rather than suppressed.


### D-010 — Problem of the Day deferred
**Decided:** POTD removed from Phase 7. Phase 7 is now problem-set expansion (42 → ~150)
plus company-filtered practice only.
**Why:** A daily rotation isn't worth much over 42 problems, and the expansion is the
prerequisite anyway. Parked in the plan's backlog rather than dropped — it's cheap (S) and
the streak logic it would hook into already exists.

### D-009 — Phase 3 scoped as hybrid retrieval (option C), companies merged in
**Decided:** Live corpus work uses **batch + confidence-triggered live fallback with
write-back to Chroma** — a read-through cache over the vector store. Not pure batch, not
pure per-query web search. Company expansion (4 → ~10) merges into the same phase.
**Why:** Pure batch is fast and cheap but only covers what we guessed users would ask.
Pure live search is 5–15s per question, costs money on every request, and returns
uncurated junk. The hybrid pays the latency once per genuine gap and serves everyone after
from the vector store, so the corpus grows around real demand.
**Why companies merge in:** new companies start with no corpus. Rather than hand-writing
guides for each, their first interviews trigger the low-confidence path and the corpus
builds itself. The fallback *is* the onboarding mechanism.
**Guardrails required:** fetch timeout, domain allowlist, per-user daily live-fetch cap.
Without these the fallback can run away with the API budget.
**Also decided:** retrieval work split into index-side (Phase 2: chunking, small-to-big,
contextual retrieval — each requires a full re-embed) and query-side (Phase 3: reranking,
hybrid+RRF, MMR, routing — cheap to try and revert). Mixing them makes it impossible to
attribute a metric change to its cause.
**Sequencing constraint:** Phase 1's baseline is measured on the current 4 companies.
Phases 2 and 3 must be measured against it *before* Phase 4 changes the corpus, or their
deltas are meaningless. Phase 4 re-baselines.

### D-008 — Phased execution with mandatory iteration loops and pauses
**Decided:** Work proceeds via `docs/EXECUTION_PLAN.md`: six phases, each with a stated
goal and exit criteria, a **minimum of three iterations** (build → verify → refine), a
**commit at the end of each phase**, and a **hard pause for approval** before the next
phase starts. Two full-system verification rounds follow all phases.
**Why:** The failure mode for a plan this size is drifting into half-finished work across
many fronts. Exit criteria (not iteration counts) gate each phase, so "done" is defined
before work starts. The pauses keep scope decisions with the user rather than accruing
silently.
**Conventions adopted:** conventional-commit prefixes matching existing history; every
commit has a title *and* a body explaining why and what was verified; commits are
co-authored by Claude; all work lands on `feat/platform-v2` and merges to `main` only
after final verification.
**Constraint recorded:** `ai-service/.env` holds live API keys and there is no free AWS
tier anymore, so LLM calls cost real money. Unit tests must never call a live model —
only the explicit eval entry point does, against a deliberately small golden set.
**Environment note:** the Docker daemon is not currently running, and system Python is
3.9.6 without langchain/chromadb. Phases 1, 3, and 5 cannot be verified without Docker
started; ai-service tests run in-container, not against system Python.

### D-007 — iOS app removed (supersedes D-003)
**Decided:** `ios/` deleted from the working tree; all iOS references stripped from
`README.md` and `CLAUDE.md`. The web app is now the only client.
**Why:** D-003 argued for keeping it on the grounds that an extra client costs nothing.
That reasoning was incomplete. The app has no realistic audience — nobody is going to
install a simulator build to evaluate this project — and maintaining it means reopening
Xcode to verify it still compiles against current toolchains. An unverifiable component
is worse than an absent one: the moment an interviewer asks "can I see it?", a build
failure is a much bigger negative than never having claimed it.
**Not destroyed:** the full app is preserved in git history at commits `e24baf6` and
`b19f09d`. Restoring is `git checkout b19f09d -- ios`.
**Side effect worth noting:** F-09 (web and iOS hand-mirroring backend types with no
shared contract) is now moot as a bug source, but the OpenAPI contract item stays on the
roadmap on its own merits — a generated TS client for `web/` still kills drift between
Express, FastAPI, and the frontend.

### D-006 — Documentation consolidated under `docs/`
**Decided:** All documentation moves to `docs/`, except `README.md` and `CLAUDE.md`,
which stay at the repo root.
**Why:** Root was accumulating loose markdown. But `README.md` is the only file GitHub
renders on the repo landing page, and Claude Code auto-discovers `CLAUDE.md` at the
root specifically — inside `docs/` it would silently never load. Those two are
load-bearing where they are.
**Going forward:** New docs go in `docs/` and get an index row in `docs/README.md`.

### D-005 — Started this decisions log
**Decided:** Track findings and decisions in `docs/DECISIONS.md`, append-only.
**Why:** The reasoning behind choices in this project (keep iOS, don't redeploy, Node
holds no AI logic) currently lives only in conversation and in someone's head. Written
down, it survives, and it's directly reusable when explaining the project in an
interview — "here's my decision log" is a strong signal on its own.

### D-004 — No redeployment; AWS section stays in past tense
**Decided:** Do not redeploy. `README.md` keeps the full AWS Deployment section but
states the environment **was** deployed and has since been torn down.
**Why:** The AWS free tier expired and the account was deleted. The work was real and
the infrastructure experience (EC2 + RDS in a private subnet, Nginx, multi-stage prod
builds, memory tuning for a 1 GB box) is worth documenting accurately. Deleting the
section would erase genuine experience; claiming a live instance would be false.
**Also considered:** Oracle Cloud Always Free (4 ARM vCPU / 24 GB, no expiry) was the
best free redeployment target; Railway/Render/Fly.io were ruled out because they don't
expose a Docker socket, which `code-runner` requires for sandboxed execution.
**Going forward:** A recorded demo video + README GIFs are the substitute for a live
link — no API quota to exhaust, no broken link for a recruiter to click.

### D-003 — Keep the iOS app, but demote it in the README ⚠️ *superseded by D-007*
**Decided:** `ios/` stays. Its README billing shrinks — out of the headline, one
compressed section instead of co-equal weight with the core.
**Why:** Deleting has no upside; nobody penalizes an extra client, and "one backend,
two native clients with feature parity" is uncommon. But the project's story is
RAG + microservices + sandboxed execution, and iOS is orthogonal to all three — every
line of README space it takes is space not spent on what actually differentiates the
project.
**Revisit if:** the Xcode project stops building. An app that doesn't compile is a
liability, not a bonus.
**Outcome:** reversed the same day — see D-007. The "revisit if" clause turned out to be
the whole argument: not wanting to re-verify the build *is* the liability condition.

### D-002 — `.cursorrules` replaced by `CLAUDE.md`
**Decided:** Deleted `.cursorrules`; wrote `CLAUDE.md` at the repo root.
**Why:** Tooling changed. The old file also mixed aspirational product spec with actual
conventions; `CLAUDE.md` carries only what's true of the code today, plus an explicit
*Known gaps* section so those aren't rediscovered every session.

### D-001 — Architecture invariant: Node orchestrates, Python does AI
**Decided (pre-existing, recorded here):** The Express backend contains zero ML/LLM
logic. Anything generated, evaluated, transcribed, or embedded goes over REST to the
FastAPI `ai-service`.
**Why:** Keeps each service small and independently deployable, and lets each side use
its natural ecosystem (LangChain + Chroma in Python, Express + pg in Node).
**Going forward:** This is the rule the whole repo is organized around. Adding an LLM
call to `backend/` is a violation, not a shortcut.

---

## Open findings (not yet decisions)

Things observed in the code that need a call made on them.

| # | Finding | Where |
|---|---|---|
| F-01 | `backend/src/__tests__/` and `ai-service/tests/` exist but are **empty**; no test runner configured in either service | both |
| F-02 | No CI of any kind — no `.github/` directory | repo root |
| F-03 | Sandbox containers run as `User: "root"` despite the images defining a `runner` user; no `CapDrop`, `no-new-privileges`, `ReadonlyRootfs`, `PidsLimit`, or CPU quota | `code-runner/src/runner.ts:82` |
| F-04 | Rate limiting is one global 500 req/15min bucket — a single user can exhaust the whole LLM API quota | `backend/src/index.ts` |
| F-05 | `memoryKb` on submissions is never measured, always null | `code-runner/src/runner.ts` |
| F-06 | Socket.IO is wired on both ends but only emits a `hello` — realtime is unused scaffolding | `backend/src/index.ts`, `web/src/lib/socket.ts` |
| F-07 | Email verification and password reset generate valid tokens, but emails are only `console.log`ed — no SMTP | `backend/src/routes/auth.routes.ts` |
| F-08 | RAG corpus is 34 hand-written documents — the weakest point in the project's strongest story | `ai-service/seed_data/documents.json` |
| F-09 | ~~Web and iOS hand-mirror backend types~~ — narrowed by D-007 (iOS removed). Still no generated contract between Express/FastAPI and `web/` | `web/src/lib/api.ts` |
| F-18 | `brendangregg` feed ingested four entries all titled "Brendan Gregg's Blog" — the feed appears to link to the index page rather than individual articles, so those chunks are low value | `ai-service/app/ingest/sources.py` |
| F-19 | `FetchLimiter` counters are in-process, so limits are per-instance. A multi-instance deployment would multiply the global daily cap by the instance count; needs Redis | `ai-service/app/ingest/limits.py` |
| F-20 | Live *discovery* depends on Gemini search grounding, which returns 429 on the free tier — the live fetch degrades safely to local context but cannot write back until quota exists (D-038) | `ai-service/app/ingest/live.py` |
| F-16 | `EmbeddingService` has no fallback on *error*: if the configured provider returns 401/404 the call raises rather than trying the other provider, unlike `invoke_with_fallback` for LLM calls | `ai-service/app/rag/embeddings.py` |
| F-17 | Retrieval metrics are identical with and without the company/stage metadata filter, so the filter currently buys nothing measurable on this corpus. Re-test after Phase 4 expands it | `ai-service/app/interview/orchestrator.py` |
| F-14 | 4 pre-existing `react-hooks` lint errors in `web/`: `setState` called synchronously in effects (theme-provider, paths/[slug], problems/[id]) and `Date.now()` called during render (dashboard "days ago" label). CI lint for `web` is `continue-on-error` until fixed | `web/src/` |
| F-15 | `UUID_REGEX` is defined independently in at least 3 route files instead of being imported from `interview-state.service.ts`, which already exports it | `backend/src/routes/` |
| F-11 | `problems.companies[]` contains both `Facebook` (3) and `Meta` (12) as separate tags for the same company | `backend/leetcode_problems.json` |
| F-12 | Only 42 problems seeded (12 easy / 18 medium / 12 hard) — thin for a practice platform | `backend/leetcode_problems.json` |
| F-13 | Problems are tagged with 13 companies but only 4 have interview profiles; Microsoft has 38 tagged problems and no profile | `ai-service/app/interview/company_profiles.py` |
| F-10 | `notes.txt` held the live RDS master password and EC2 IP in plaintext. Correctly gitignored, never committed, and since deleted along with the AWS account — no exposure, recorded for completeness | *(removed)* |
