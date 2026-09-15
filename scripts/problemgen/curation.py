"""Hand-curated problem metadata that overrides the batch generators (Phase 7, F-21).

    python scripts/problemgen/apply_curation.py   # write these tags into leetcode_problems.json

Company tags are the single source of truth here, for all 150 problems -- the
original 42 and every generated one. `common.upsert_problems` reads COMPANY_TAGS
instead of a spec's own tags, so re-running a batch generator cannot revert a
curation, and a new problem cannot be generated until it has an entry below.

Rules: 3-5 companies per problem, only the 10 interview companies (the same list
as `backend/src/services/interview-state.service.ts`), listed most-associated
first. Tags are still approximate -- judged from commonly reported interview
lists, not from any authoritative source -- but they are chosen per problem
rather than defaulting to the biggest names.
"""
from __future__ import annotations

AMZ, GOO, META, APL, MSFT = "Amazon", "Google", "Meta", "Apple", "Microsoft"
UBER, BBG, ADBE, LNKD, ABNB = "Uber", "Bloomberg", "Adobe", "LinkedIn", "Airbnb"

ALLOWED_COMPANIES = (AMZ, GOO, META, APL, MSFT, UBER, BBG, ADBE, LNKD, ABNB)
MIN_TAGS, MAX_TAGS = 3, 5

COMPANY_TAGS = {
    # ── original 42 ──────────────────────────────────────────────────────
    "two-sum": [AMZ, GOO, META, ABNB, MSFT],
    "reverse-string": [APL, MSFT, ADBE],
    "valid-parentheses": [AMZ, META, BBG, ABNB, LNKD],
    "best-time-to-buy-and-sell-stock": [AMZ, META, BBG, UBER],
    "merge-two-sorted-lists": [AMZ, MSFT, APL, ADBE],
    "missing-number": [MSFT, AMZ, APL],
    "contains-duplicate": [AMZ, APL, ADBE, ABNB],
    "valid-palindrome": [META, MSFT, APL],
    "maximum-subarray": [LNKD, AMZ, MSFT, APL],
    "climbing-stairs": [ADBE, APL, GOO],
    "linked-list-cycle": [AMZ, MSFT, BBG],
    "invert-binary-tree": [GOO, AMZ, APL],
    "longest-substring-without-repeating-characters": [AMZ, BBG, META, ADBE],
    "3sum": [META, AMZ, BBG, ADBE],
    "product-of-array-except-self": [AMZ, META, LNKD, APL],
    "number-of-islands": [AMZ, META, GOO, UBER],
    "course-schedule": [AMZ, GOO, META, UBER],
    "coin-change": [AMZ, GOO, BBG, UBER],
    "top-k-frequent-elements": [AMZ, META, UBER, GOO],
    "lowest-common-ancestor-of-a-binary-search-tree": [META, LNKD, AMZ, MSFT],
    "implement-trie-prefix-tree": [GOO, AMZ, MSFT, UBER],
    "container-with-most-water": [AMZ, GOO, BBG, ADBE],
    "search-in-rotated-sorted-array": [META, LNKD, MSFT, AMZ],
    "group-anagrams": [AMZ, UBER, BBG, MSFT],
    "rotate-image": [MSFT, AMZ, APL, UBER],
    "validate-binary-search-tree": [AMZ, BBG, META, MSFT],
    "binary-tree-level-order-traversal": [AMZ, LNKD, META, MSFT],
    "rotting-oranges": [AMZ, GOO, MSFT],
    "word-break": [AMZ, GOO, META, UBER],
    "task-scheduler": [META, AMZ, UBER],
    "trapping-rain-water": [GOO, AMZ, BBG, ABNB],
    "merge-k-sorted-lists": [AMZ, META, GOO, ABNB],
    "word-search-ii": [AMZ, GOO, MSFT, ABNB],
    "median-of-two-sorted-arrays": [GOO, AMZ, APL, ADBE],
    "longest-valid-parentheses": [AMZ, GOO, BBG],
    "minimum-window-substring": [META, LNKD, UBER, ABNB],
    "edit-distance": [GOO, AMZ, LNKD],
    "largest-rectangle-in-histogram": [AMZ, GOO, MSFT, BBG],
    "n-queens": [AMZ, APL, MSFT],
    "maximum-profit-in-job-scheduling": [ABNB, GOO, AMZ, LNKD],
    "serialize-and-deserialize-binary-tree": [LNKD, AMZ, META, UBER],
    "find-median-from-data-stream": [AMZ, GOO, APL, UBER],
    # ── batch 1: easy ────────────────────────────────────────────────────
    "valid-anagram": [AMZ, BBG, UBER],
    "reverse-linked-list": [AMZ, APL, MSFT, ADBE],
    "maximum-depth-of-binary-tree": [LNKD, APL, GOO],
    "same-tree": [BBG, MSFT, LNKD],
    "symmetric-tree": [LNKD, MSFT, BBG],
    "binary-search": [GOO, MSFT, ADBE],
    "ransom-note": [APL, MSFT, ADBE],
    "majority-element": [AMZ, GOO, ADBE],
    "single-number": [APL, ABNB, GOO],
    "move-zeroes": [META, BBG, APL],
    "palindrome-number": [APL, ADBE, BBG],
    "roman-to-integer": [MSFT, BBG, ADBE],
    "longest-common-prefix": [GOO, APL, ADBE],
    "plus-one": [GOO, ADBE, LNKD],
    "sqrtx": [BBG, APL, MSFT],
    "merge-sorted-array": [META, MSFT, BBG],
    "pascals-triangle": [ADBE, APL, MSFT],
    "diameter-of-binary-tree": [META, AMZ, GOO],
    "balanced-binary-tree": [AMZ, GOO, BBG],
    "middle-of-the-linked-list": [APL, ADBE, MSFT],
    "palindrome-linked-list": [META, MSFT, APL],
    "intersection-of-two-arrays": [LNKD, META, BBG],
    "happy-number": [GOO, APL, UBER],
    "is-subsequence": [GOO, META, BBG],
    "counting-bits": [APL, ADBE, MSFT],
    "fizz-buzz": [MSFT, APL, LNKD],
    "search-insert-position": [GOO, ADBE, APL],
    "add-binary": [META, MSFT, APL],
    "binary-tree-inorder-traversal": [MSFT, ADBE, APL],
    "flood-fill": [AMZ, GOO, UBER],
    "island-perimeter": [AMZ, META, GOO, BBG],
    # ── batch 2a: medium ─────────────────────────────────────────────────
    "add-two-numbers": [MSFT, BBG, ADBE, ABNB],
    "generate-parentheses": [GOO, AMZ, UBER],
    "remove-nth-node-from-end-of-list": [META, AMZ, APL],
    "search-a-2d-matrix": [MSFT, BBG, APL],
    "find-minimum-in-rotated-sorted-array": [MSFT, BBG, GOO],
    "kth-largest-element-in-an-array": [META, LNKD, AMZ, MSFT],
    "subsets": [META, AMZ, BBG, UBER],
    "combination-sum": [ABNB, AMZ, UBER],
    "letter-combinations-of-a-phone-number": [AMZ, UBER, GOO, META],
    "word-search": [AMZ, MSFT, BBG, META],
    "spiral-matrix": [MSFT, GOO, APL, UBER],
    "set-matrix-zeroes": [MSFT, AMZ, META],
    "jump-game": [AMZ, MSFT, APL],
    "unique-paths": [GOO, BBG, UBER],
    "longest-increasing-subsequence": [GOO, AMZ, MSFT],
    "house-robber": [AMZ, GOO, ABNB, LNKD],
    "house-robber-ii": [MSFT, GOO, ADBE],
    "decode-ways": [META, GOO, UBER],
    "partition-equal-subset-sum": [META, APL, ADBE],
    "longest-common-subsequence": [AMZ, GOO, MSFT],
    "merge-intervals": [META, GOO, BBG, UBER],
    "insert-interval": [GOO, LNKD, META],
    "non-overlapping-intervals": [META, GOO, UBER],
    # ── batch 2b: medium ─────────────────────────────────────────────────
    "daily-temperatures": [AMZ, META, GOO],
    "evaluate-reverse-polish-notation": [LNKD, AMZ, GOO],
    "min-stack": [AMZ, BBG, MSFT],
    "lru-cache": [AMZ, MSFT, META, BBG],
    "binary-tree-right-side-view": [META, AMZ, BBG],
    "kth-smallest-element-in-a-bst": [AMZ, UBER, GOO],
    "construct-binary-tree-from-preorder-and-inorder-traversal": [BBG, MSFT, META],
    "count-good-nodes-in-binary-tree": [MSFT, AMZ, GOO],
    "pacific-atlantic-water-flow": [GOO, AMZ, UBER],
    "number-of-provinces": [AMZ, GOO, LNKD],
    "gas-station": [AMZ, GOO, BBG],
    "sort-colors": [MSFT, AMZ, ADBE],
    "find-the-duplicate-number": [AMZ, BBG, GOO],
    "longest-consecutive-sequence": [GOO, AMZ, META],
    "valid-sudoku": [AMZ, APL, UBER],
    "subarray-sum-equals-k": [META, GOO, AMZ],
    "maximum-product-subarray": [LNKD, AMZ, MSFT],
    "palindromic-substrings": [META, LNKD, GOO],
    "coin-change-ii": [BBG, MSFT, GOO],
    "target-sum": [META, GOO, ADBE],
    "rotate-array": [MSFT, BBG, ADBE],
    "koko-eating-bananas": [GOO, META, ABNB],
    "time-based-key-value-store": [GOO, UBER, AMZ, ABNB],
    # ── batch 3a: hard ───────────────────────────────────────────────────
    "regular-expression-matching": [GOO, META, ABNB],
    "wildcard-matching": [GOO, META, ADBE],
    "first-missing-positive": [AMZ, GOO, MSFT],
    "sliding-window-maximum": [GOO, UBER, ABNB],
    "word-ladder": [AMZ, META, LNKD],
    "binary-tree-maximum-path-sum": [META, GOO, LNKD],
    "reverse-nodes-in-k-group": [MSFT, AMZ, META],
    "longest-increasing-path-in-a-matrix": [GOO, AMZ, META],
    "burst-balloons": [GOO, MSFT, ADBE],
    "distinct-subsequences": [GOO, BBG, AMZ],
    "best-time-to-buy-and-sell-stock-iv": [AMZ, APL, BBG],
    "candy": [AMZ, UBER, GOO],
    "basic-calculator": [GOO, AMZ, META],
    "count-of-smaller-numbers-after-self": [GOO, AMZ, UBER],
    "maximal-rectangle": [GOO, ABNB, APL],
    "palindrome-partitioning-ii": [GOO, ADBE, BBG],
    # ── batch 3b: hard ───────────────────────────────────────────────────
    "minimum-number-of-refueling-stops": [GOO, AMZ, UBER],
    "swim-in-rising-water": [GOO, ABNB, UBER],
    "cherry-pickup": [GOO, ABNB, AMZ],
    "split-array-largest-sum": [GOO, AMZ, META],
    "n-queens-ii": [MSFT, ADBE, APL],
    "shortest-palindrome": [GOO, ADBE, MSFT],
    "max-points-on-a-line": [LNKD, APL, GOO],
    "critical-connections-in-a-network": [AMZ, META, GOO],
    "trapping-rain-water-ii": [GOO, AMZ, ABNB],
    "the-skyline-problem": [GOO, MSFT, UBER],
    "number-of-digit-one": [GOO, MSFT, APL],
    "integer-to-english-words": [META, AMZ, MSFT],
    "dungeon-game": [GOO, MSFT, UBER],
    "best-time-to-buy-and-sell-stock-iii": [AMZ, GOO, APL],
    "lfu-cache": [AMZ, GOO, LNKD],
}


def _duplicate_keys():
    """Slugs written twice in COMPANY_TAGS -- a dict literal silently keeps only the last one."""
    import ast
    with open(__file__) as handle:
        tree = ast.parse(handle.read())
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and any(getattr(t, "id", None) == "COMPANY_TAGS" for t in node.targets):
            keys = [k.value for k in node.value.keys]
            return sorted({k for k in keys if keys.count(k) > 1})
    raise SystemExit("curation: COMPANY_TAGS assignment not found")


def validate(slugs=None):
    """Raise if any entry breaks the rules; if `slugs` is given, require exact coverage."""
    duplicates = _duplicate_keys()
    if duplicates:
        raise SystemExit(f"curation: slugs listed more than once {duplicates}")
    for slug, tags in COMPANY_TAGS.items():
        if not MIN_TAGS <= len(tags) <= MAX_TAGS:
            raise SystemExit(f"curation: {slug} has {len(tags)} companies, want {MIN_TAGS}-{MAX_TAGS}")
        if len(set(tags)) != len(tags):
            raise SystemExit(f"curation: {slug} lists a company twice")
        unknown = set(tags) - set(ALLOWED_COMPANIES)
        if unknown:
            raise SystemExit(f"curation: {slug} has non-interview companies {sorted(unknown)}")
    if slugs is not None:
        missing, extra = set(slugs) - set(COMPANY_TAGS), set(COMPANY_TAGS) - set(slugs)
        if missing or extra:
            raise SystemExit(f"curation: missing {sorted(missing)} extra {sorted(extra)}")


def companies_for(slug):
    """The curated tags for a problem; a problem without an entry is an error, not a fallback."""
    validate()
    if slug not in COMPANY_TAGS:
        raise SystemExit(f"curation: {slug} has no COMPANY_TAGS entry -- add one to scripts/problemgen/curation.py")
    return list(COMPANY_TAGS[slug])
