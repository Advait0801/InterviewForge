# Phase 12 — Empirical complexity and Elo-rated adaptive difficulty

Decisions: D-076 (complexity), D-077 (Elo). No model calls were needed except one review in
the live check ($0.0001).

## 1. Empirical complexity

**Question:** time an accepted solution on inputs that double in size, fit a growth class, and
compare it with the class the AI reviewer claimed. Is the fit correct on solutions whose
complexity is known?

**Method.** The code-runner times the user's call alone (arguments built, output not yet
formatted) inside the sandbox, in all seven languages, and flushes after every case, so a run
stopped by its 20 s limit keeps every size it finished. Thirty problems have curated input
generators that force the full work: two-sum's only pair is planted last, palindromes are all one
letter, and products of ±1 keep Python's integers small. Each size runs three times, after five
warm-ups, and the fastest run is kept. For each class, the fit is `t = a + b·f(n)` minimising
relative error (`backend/src/services/complexity.ts`).

**Known solutions** (`scripts/complexity_known.py`; fixture
`backend/src/__tests__/fixtures/complexity-measurements.json`). The merge sorts are written by
hand in each language, so the log factor is real work in that language:

| solution | true class | the measurement allows | log-log slope | sizes | stopped |
|---|---|---|---|---|---|
| py two-sum hash map | O(n) | O(n) or O(n log n) | 1.068 | 10 | done |
| py two-sum brute force | O(n²) | **O(n²)** | 2.023 | 7 | time_limit |
| py merge sort | O(n log n) | **O(n log n)** | 1.075 | 10 | done |
| py counting sort | O(n) | **O(n)** | 0.997 | 10 | done |
| py binary search | O(log n) | O(1) or O(log n) | too fast to separate | 10 | done |
| py linear search | O(n) | O(n) or O(n log n) | 0.998 | 10 | done |
| py palindromic substrings | O(n²) | **O(n²)** | 2.005 | 8 | done |
| py longest common subsequence | O(n²) | **O(n²)** | 2.037 | 7 | done |
| js two-sum map | O(n) | O(n) or O(n log n) | 1.07 | 10 | done |
| js two-sum brute force | O(n²) | **O(n²)** | 1.999 | 10 | done |
| js merge sort | O(n log n) | O(n) or O(n log n) | 1.137 | 10 | done |
| cpp two-sum hash map | O(n) | O(n) or O(n log n) | 1.133 | 10 | done |
| cpp two-sum brute force | O(n²) | **O(n²)** | 2.011 | 10 | done |
| cpp merge sort | O(n log n) | O(n) or O(n log n) | 1.032 | 10 | done |
| java two-sum hash map | O(n) | O(n) or O(n log n) | 1.183 | 10 | done |
| java two-sum brute force | O(n²) | **O(n²)** | 1.981 | 10 | done |
| java merge sort | O(n log n) | O(n) or O(n log n) | 1.027 | 10 | done |
| c counting sort | O(n) | O(n) or O(n log n) | 0.999 | 10 | done |
| c insertion sort | O(n²) | **O(n²)** | 1.998 | 10 | done |
| c merge sort | O(n log n) | O(n) or O(n log n) | 1.027 | 10 | done |
| go two-sum map | O(n) | O(n) or O(n log n) | 1.074 | 10 | done |
| go two-sum brute force | O(n²) | **O(n²)** | 1.999 | 10 | done |
| go merge sort | O(n log n) | O(n) or O(n log n) | 1.038 | 10 | done |
| rust two-sum hash map | O(n) | O(n) or O(n log n) | 1.005 | 10 | done |
| rust two-sum brute force | O(n²) | **O(n²)** | 2 | 10 | done |
| rust merge sort | O(n log n) | O(n) or O(n log n) | 1.04 | 10 | done |

- **26 of 26 correct:** the true class is always among what the measurement allows, and nothing
  from another family is (no quadratic for a linear solution, or the reverse). This held on two
  separate collections and through the live API (`scripts/verify_complexity.py`, 96/96).
- **Every quadratic is identified exactly, in all seven languages.** Slopes are 1.98–2.04.
- **O(n) and O(n log n) are usually reported together, deliberately.** Across 2⁸–2¹⁷, a log
  factor changes the cost per element by at most 2.1×, and memory effects are as large: a C++
  `unordered_map` measured as O(n log n) **3× better** than O(n) once it outgrew the caches, while
  C++ and Rust merge sorts measured as O(n) 2× better than O(n log n). With the usual 1.5× rule,
  three of the first collection's answers were simply wrong. Naming one of the two alone now
  takes a 3.5× better fit. That rule names Python's merge sort and counting sort exactly, and
  reports both classes everywhere else.
- **Binary search is "too fast to separate".** Every size of an O(log n) search runs in about
  a microsecond, under the timer's noise, so the answer is honestly "O(1) or O(log n)".

**Found on the way.** The C harness read every argument through a fixed 4,096- or
8,192-character buffer, so a longer line was silently split into the next argument. That has
affected C custom test cases (up to 10,000 characters) since Phase 7. C now reads lines of any
length. Re-verified: all 150 C reference solutions still pass, and a 5,400-character custom input
in C is judged and passes.

## 2. Elo-rated adaptive difficulty

**Question:** does picking the unattempted problem whose predicted first-try success is closest
to 65% actually give users about 65% success?

**Method** (`backend/src/eval/elo-simulation.ts`, `npx ts-node scripts/simulate_elo.ts`):

- 200 synthetic users with a known true skill per topic play the real 150 problems.
- Each problem's true difficulty is its label's rating plus noise (σ 150) the system never
  sees. Problem ratings start at the labels and have to learn.
- Users succeed with their *true* probability and are rated by the production code. 40 picks
  each; measured after a 10-game warm-up.
- Baselines on identical users and problems: a random unattempted problem; a "difficulty label
  ladder" (a harder label after a pass, an easier one after a fail); and an **oracle** that knows
  every true skill and difficulty, which is the best any picker could do.

| world | Elo success | oracle | random | ladder | per-user gap (Elo / oracle / random) | users within ±0.10 (Elo / oracle) |
|---|---|---|---|---|---|---|
| default (seed 7) | **0.638** | 0.629 | 0.495 | 0.498 | 0.110 / 0.108 / 0.232 | 0.585 / 0.58 |
| seed 11 | **0.650** | 0.643 | 0.503 | 0.516 | 0.091 / 0.092 / 0.220 | 0.705 / 0.68 |
| seed 23 | **0.635** | 0.630 | 0.504 | 0.514 | 0.109 / 0.101 / 0.217 | 0.60 / 0.665 |
| true curve scale 300 (not Elo's 400) | **0.641** | 0.639 | 0.500 | 0.494 | 0.108 / 0.117 / 0.241 | 0.63 / 0.60 |
| true curve scale 550 | **0.632** | 0.625 | 0.498 | 0.498 | 0.104 / 0.106 / 0.209 | 0.62 / 0.63 |
| label noise σ 250 | **0.636** | 0.643 | 0.497 | 0.497 | 0.090 / 0.104 / 0.218 | 0.68 / 0.60 |

- **The target is hit:** 0.632–0.650 in every world, including worlds whose true success curve
  is not the one Elo assumes.
- **It matches the oracle.** Its per-user gap and its share of users within ±0.10 are within
  noise of a picker that knows the truth. With 30 games per user, coin-flip noise alone keeps
  about a third of users more than 0.10 from 65%.
- **Calibration:** in the default world, 86% of games were predicted at 0.65, and 64.8% of
  those passed.
- **It learns difficulty:** learned problem ratings correlate 0.888 with true difficulty, against
  0.819 for the labels alone (0.818 vs 0.633 with noisier labels).

**What it took:**

- **Per-topic ratings alone weren't enough.** Forty problems over about 15 topics is 2–3 games per
  topic, and only 46% of users landed within ±0.10. Adding an overall rating fixed that: a
  topic now starts from it, and a sparse topic is blended toward it (games/(games+4)). The share
  rose to 58.5%.
- **The start rating stays at 1500.** Starting users at 1300, so a newcomer's first easy problem
  is predicted at 65%, made steady state worse: success rose to 0.69–0.72, too-easy problems for
  longer. The cost is a cold start. While every problem is still at its label's rating, a new
  user's choices are 85%, 50% or 15%, so the first pick is a 50% medium; picks reach 65% as
  ratings spread with play.
- **A skewed population is limited by the problem set, not the picker.** With users centred at
  1300 or 1700, even the oracle reaches only 0.525 or 0.691: there are too few very easy or very
  hard problems.

**Live** (`scripts/verify_elo.py`, 16/16):

- A first Submit is rated, and later ones are not.
- The problem's rating moves the opposite way.
- `/ratings/next` never offers a submitted problem.
- In each of 5 races, two simultaneous first Submits rate exactly one submission. The first
  attempt **deadlocked**: `FOR UPDATE` on the user's row conflicts with the foreign-key lock that
  the other transaction's submission insert holds. `FOR NO KEY UPDATE` fixed it, with zero
  deadlocks over 15 further races.
