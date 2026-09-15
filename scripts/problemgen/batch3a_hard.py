"""Phase 7 batch 3a: 16 hard problems.

    python scripts/problemgen/batch3a_hard.py

Same rules as earlier batches. Oracles lean on genuinely different machinery
where it exists -- Python's `re` engine for regular expressions, `fnmatch` for
wildcards, `eval` for the calculator, bitmask search for burst balloons, and
brute force over every rectangle / every path -- so they share no logic with the
reference solutions. Inputs are sized so those oracles stay fast.
"""
from __future__ import annotations

import fnmatch
import os
import re
import sys
from functools import lru_cache

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import C_ARR_NOTE, rand_str, random_tree, templates, tree_from_level, tree_to_level, write_all  # noqa: E402

INT_MAX = 2**31 - 1


def P(**spec):
    spec.setdefault("difficulty", "hard")
    return spec


def _nodes(root):
    out, stack = [], [root] if root else []
    while stack:
        node = stack.pop()
        out.append(node)
        stack.extend(c for c in (node.right, node.left) if c)
    return out


# ── oracles ──────────────────────────────────────────────────────────────

def ladder_oracle(begin, end, words):
    if end not in words:
        return 0

    def one_apart(a, b):
        return sum(x != y for x, y in zip(a, b)) == 1

    nodes = [begin] + [w for w in words if w != begin]
    dist, frontier = {begin: 1}, [begin]
    while frontier:
        nxt = []
        for a in frontier:
            for b in nodes:
                if b not in dist and one_apart(a, b):
                    dist[b] = dist[a] + 1
                    nxt.append(b)
        frontier = nxt
    return dist.get(end, 0)


def max_path_oracle(level):
    # Walk every simple path from every start node: O(n^2), no DP.
    root = tree_from_level(level)
    nodes = _nodes(root)
    neighbours = {node: [] for node in nodes}
    for node in nodes:
        for child in (node.left, node.right):
            if child:
                neighbours[node].append(child)
                neighbours[child].append(node)
    best = max(node.val for node in nodes)
    for start in nodes:
        stack = [(start, None, start.val)]
        while stack:
            node, parent, total = stack.pop()
            best = max(best, total)
            for nb in neighbours[node]:
                if nb is not parent:
                    stack.append((nb, node, total + nb.val))
    return best


def reverse_k_oracle(head, k):
    out = []
    for i in range(0, len(head), k):
        chunk = head[i:i + k]
        out.extend(chunk[::-1] if len(chunk) == k else chunk)
    return out


def lip_oracle(matrix):
    # Process cells in increasing value order, so every smaller neighbour is final.
    m, n = len(matrix), len(matrix[0])
    best = {}
    for v, r, c in sorted((matrix[r][c], r, c) for r in range(m) for c in range(n)):
        cur = 1
        for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if 0 <= nr < m and 0 <= nc < n and matrix[nr][nc] < v:
                cur = max(cur, best[(nr, nc)] + 1)
        best[(r, c)] = cur
    return max(best.values())


def burst_oracle(nums):
    n = len(nums)

    @lru_cache(maxsize=None)
    def go(mask):  # bit i set = balloon i still present
        if mask == 0:
            return 0
        present = [i for i in range(n) if mask >> i & 1]
        best = 0
        for idx, i in enumerate(present):
            left = nums[present[idx - 1]] if idx > 0 else 1
            right = nums[present[idx + 1]] if idx + 1 < len(present) else 1
            best = max(best, left * nums[i] * right + go(mask & ~(1 << i)))
        return best

    return go((1 << n) - 1)


def distinct_oracle(s, t):
    m, n = len(s), len(t)
    ways = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        ways[i][n] = 1
    for i in range(m - 1, -1, -1):
        for j in range(n - 1, -1, -1):
            ways[i][j] = ways[i + 1][j] + (ways[i + 1][j + 1] if s[i] == t[j] else 0)
    return ways[0][0]


def distinct_fits(s, t):
    # The references keep a forward 1-D table; keep every entry within an int.
    dp = [1] + [0] * len(t)
    for ch in s:
        for j in range(len(t), 0, -1):
            if t[j - 1] == ch:
                dp[j] += dp[j - 1]
        if max(dp) > INT_MAX:
            return False
    return True


def stock_k_oracle(k, prices):
    # f[j]: best profit by day j using at most t transactions. O(k * n^2).
    n = len(prices)
    f = [0] * n
    for _ in range(k):
        g = [0] * n
        for j in range(n):
            best = max(f[j], g[j - 1] if j else 0)
            for i in range(j):
                best = max(best, prices[j] - prices[i] + (f[i - 1] if i else 0))
            g[j] = best
        f = g
    return f[-1]


def candy_oracle(ratings):
    candies = [1] * len(ratings)
    changed = True
    while changed:
        changed = False
        for i in range(len(ratings)):
            for j in (i - 1, i + 1):
                if 0 <= j < len(ratings) and ratings[i] > ratings[j] and candies[i] <= candies[j]:
                    candies[i] = candies[j] + 1
                    changed = True
    return sum(candies)


def calculator_oracle(s):
    assert set(s) <= set("0123456789+-() ")
    return eval(s)  # generated input over a fixed character set only


def maximal_rect_oracle(matrix):
    m, n = len(matrix), len(matrix[0])
    prefix = [[0] * (n + 1) for _ in range(m + 1)]
    for r in range(m):
        for c in range(n):
            prefix[r + 1][c + 1] = prefix[r][c + 1] + prefix[r + 1][c] - prefix[r][c] + (matrix[r][c] == "1")
    best = 0
    for r1 in range(m):
        for r2 in range(r1, m):
            for c1 in range(n):
                for c2 in range(c1, n):
                    area = (r2 - r1 + 1) * (c2 - c1 + 1)
                    if area > best and prefix[r2 + 1][c2 + 1] - prefix[r1][c2 + 1] - prefix[r2 + 1][c1] + prefix[r1][c1] == area:
                        best = area
    return best


def min_cut_oracle(s):
    n = len(s)
    pieces = [0] * (n + 1)
    for i in range(1, n + 1):
        pieces[i] = min(pieces[j] + 1 for j in range(i) if s[j:i] == s[j:i][::-1])
    return pieces[n] - 1


# ── case generators ──────────────────────────────────────────────────────

def regex_cases(rng):
    yield from [("aa", "a"), ("aa", "a*"), ("ab", ".*"), ("aab", "c*a*b"), ("mississippi", "mis*is*p*."), ("a", ".*..a*"), ("ab", ".*c")]
    while True:
        alpha = rng.choice(["a", "ab", "abc"])
        tokens = [rng.choice(alpha + ".") + ("*" if rng.random() < 0.4 else "") for _ in range(rng.randint(1, 8))]
        p = "".join(tokens)
        if len(p) > 20:
            continue
        if rng.random() < 0.6:
            s = "".join((rng.choice(alpha) if t[0] == "." else t[0]) * (rng.randint(0, 3) if t.endswith("*") else 1) for t in tokens)
            if s and rng.random() < 0.3:
                i = rng.randrange(len(s))
                s = s[:i] + rng.choice(alpha) + s[i + 1:]
        else:
            s = rand_str(rng, rng.randint(1, 12), alpha)
        if 1 <= len(s) <= 20:
            yield (s, p)


def wildcard_cases(rng):
    yield from [("aa", "a"), ("aa", "*"), ("cb", "?a"), ("adceb", "*a*b"), ("acdcb", "a*c?b"), ("", "*"), ("", ""), ("a", ""), ("", "?"),
                ("ab", "ab*"), ("abc", "abc**"), ("", "**")]
    while True:
        alpha = rng.choice(["a", "ab", "abc"])
        s = rand_str(rng, rng.randint(0, 300 if rng.random() < 0.3 else 12), alpha)
        if s and rng.random() < 0.6:
            out, i = [], 0
            while i < len(s):
                roll = rng.random()
                if roll < 0.2:
                    out.append("*")
                    i = rng.randint(i, len(s))
                elif roll < 0.35:
                    out.append("?")
                    i += 1
                else:
                    out.append(s[i])
                    i += 1
            if rng.random() < 0.3:
                out.insert(rng.randint(0, len(out)), rng.choice(alpha + "*?"))
            if rng.random() < 0.35:
                # Trailing stars that must match the empty rest of s. Without these, a matcher
                # that never skips them after the scan passed 49/50.
                out.append("*" * rng.randint(1, 3))
            p = "".join(out)
        else:
            p = "".join(rng.choice(alpha + "?*") for _ in range(rng.randint(0, 12)))
        yield (s, p)


def first_missing_cases(rng):
    yield from [([1, 2, 0],), ([3, 4, -1, 1],), ([7, 8, 9, 11, 12],), ([1],), ([2],), ([1, 1],), ([2147483647, -2147483648],)]
    while True:
        n = rng.randint(1, 250 if rng.random() < 0.5 else 10)
        if rng.random() < 0.5:
            vals = list(range(1, n + 1))
            rng.shuffle(vals)
            for i in rng.sample(range(n), rng.randint(0, max(1, n // 4))):
                vals[i] = rng.choice([0, -1, n + rng.randint(1, 5), rng.randint(1, n)])
        else:
            lo, hi = rng.choice([(-5, 15), (-2**31, 2**31 - 1)])
            vals = [rng.randint(lo, hi) for _ in range(n)]
        yield (vals,)


def window_cases(rng):
    yield from [([1, 3, -1, -3, 5, 3, 6, 7], 3), ([1], 1), ([9, 11], 2), ([4, -2], 2), ([7, 2, 4], 1)]
    while True:
        lo, hi = rng.choice([(-10000, 10000), (-3, 3)])
        nums = [rng.randint(lo, hi) for _ in range(rng.randint(1, 300 if rng.random() < 0.5 else 10))]
        yield (nums, rng.randint(1, len(nums)))


def ladder_cases(rng):
    yield from [("hit", "cog", ["hot", "dot", "dog", "lot", "log", "cog"]), ("hit", "cog", ["hot", "dot", "dog", "lot", "log"]),
                ("a", "c", ["a", "b", "c"]), ("hot", "dog", ["hot", "dog"])]
    while True:
        length = rng.randint(1, 5)
        alpha = "abcdefghij"[: rng.randint(2, 5)]
        size = rng.randint(1, 200 if rng.random() < 0.3 else 15)
        # dict.fromkeys, not set: set order depends on the per-process hash seed.
        words = list(dict.fromkeys(rand_str(rng, length, alpha) for _ in range(size * 2)))[:size]
        begin = rand_str(rng, length, alpha)
        if rng.random() < 0.3:
            cur = begin
            for _ in range(rng.randint(1, 6)):
                i = rng.randrange(length)
                cur = cur[:i] + rng.choice(alpha) + cur[i + 1:]
                if cur not in words:
                    words.append(cur)
        end = rng.choice(words) if rng.random() < 0.85 else rand_str(rng, length, alpha)
        if end == begin:
            continue
        rng.shuffle(words)
        yield (begin, end, words)


def max_path_cases(rng):
    yield from [([1, 2, 3],), ([-10, 9, 20, None, None, 15, 7],), ([-3],), ([2, -1],), ([-1, -2, 10, -6, None, -3, -6],)]
    while True:
        n = rng.randint(1, 150 if rng.random() < 0.4 else 10)
        lo, hi = rng.choice([(-1000, 1000), (-10, 5), (-5, 10)])
        yield (tree_to_level(random_tree(rng, n, lo, hi)),)


def reverse_k_cases(rng):
    yield from [([1, 2, 3, 4, 5], 2), ([1, 2, 3, 4, 5], 3), ([1], 1), ([1, 2], 2), ([1, 2, 3], 1)]
    while True:
        n = rng.randint(1, 300 if rng.random() < 0.4 else 12)
        yield ([rng.randint(0, 1000) for _ in range(n)], rng.randint(1, n))


def lip_cases(rng):
    yield from [([[9, 9, 4], [6, 6, 8], [2, 1, 1]],), ([[3, 4, 5], [3, 2, 6], [2, 2, 1]],), ([[1]],), ([[7, 7], [7, 7]],)]
    while True:
        if rng.random() < 0.3:
            m, n, hi = rng.randint(1, 10), rng.randint(1, 10), INT_MAX
        else:
            m, n, hi = rng.randint(1, 20), rng.randint(1, 20), rng.choice([3, 9, 50])
        yield ([[rng.randint(0, hi) for _ in range(n)] for _ in range(m)],)


def burst_cases(rng):
    yield from [([3, 1, 5, 8],), ([1, 5],), ([7],), ([0, 0],), ([9, 76, 64, 21, 97, 60],)]
    while True:
        yield ([rng.randint(0, rng.choice([3, 10, 100])) for _ in range(rng.randint(1, 10))],)


def distinct_cases(rng):
    yield from [("rabbbit", "rabbit"), ("babgbag", "bag"), ("a", "b"), ("aaa", "a"), ("abc", "abcd")]
    while True:
        alpha = rng.choice(["ab", "abc", "abcdef"])
        s = rand_str(rng, rng.randint(1, 200 if rng.random() < 0.4 else 15), alpha)
        if rng.random() < 0.6 and s:
            idx = sorted(rng.sample(range(len(s)), rng.randint(1, min(10, len(s)))))
            t = "".join(s[i] for i in idx)
        else:
            t = rand_str(rng, rng.randint(1, 10), alpha)
        if distinct_fits(s, t):
            yield (s, t)


def stock_k_cases(rng):
    yield from [(2, [2, 4, 1]), (2, [3, 2, 6, 5, 0, 3]), (1, [5]), (100, [1, 2, 3, 4, 5]), (1, [7, 6, 4, 3, 1]), (3, [1, 3, 1, 3, 1, 3, 1, 3])]
    while True:
        if rng.random() < 0.2:
            k, n = rng.randint(31, 100), rng.randint(1, 30)
        else:
            k, n = rng.randint(1, 30), rng.randint(1, 60 if rng.random() < 0.5 else 10)
        hi = rng.choice([5, 100, 1000])
        yield (k, [rng.randint(0, hi) for _ in range(n)])


def candy_cases(rng):
    yield from [([1, 0, 2],), ([1, 2, 2],), ([5],), ([1, 3, 2, 2, 1],), ([1, 2, 87, 87, 87, 2, 1],)]
    while True:
        n = rng.randint(1, 300 if rng.random() < 0.4 else 10)
        roll = rng.random()
        if roll < 0.2:
            vals = sorted(rng.randint(0, 20000) for _ in range(n))
            if rng.random() < 0.5:
                vals.reverse()
            yield (vals,)
        else:
            hi = rng.choice([2, 5, 20000])
            yield ([rng.randint(0, hi) for _ in range(n)],)


def calculator_cases(rng):
    yield from [("1 + 1",), (" 2-1 + 2 ",), ("(1+(4+5+2)-3)+(6+8)",), ("-2",), ("-(2 + 3)",), ("1-(     -2)",), ("2147483647",)]

    def expr(depth):
        parts = []
        for i in range(rng.randint(1, 4)):
            if depth > 0 and rng.random() < 0.35:
                term = "(" + expr(depth - 1) + ")"
            else:
                term = str(rng.randint(0, 10000 if rng.random() < 0.3 else 20))
            if i == 0:
                parts.append(("-" if rng.random() < 0.25 else "") + term)
            else:
                parts.append(rng.choice("+-") + term)
        return "".join(parts)

    while True:
        raw = expr(rng.randint(0, 4))
        out = []
        for i, ch in enumerate(raw):
            out.append(ch)
            nxt = raw[i + 1] if i + 1 < len(raw) else ""
            # Spaces go between tokens only; never inside a number.
            if nxt and not (ch.isdigit() and nxt.isdigit()) and rng.random() < 0.3:
                out.append(" " * rng.randint(1, 3))
        s = (" " if rng.random() < 0.2 else "") + "".join(out) + (" " if rng.random() < 0.2 else "")
        if len(s) <= 1500:
            yield (s,)


def count_smaller_cases(rng):
    yield from [([5, 2, 6, 1],), ([-1],), ([-1, -1],), ([10000, -10000],), ([1, 2, 3],)]
    while True:
        lo, hi = rng.choice([(-10000, 10000), (-3, 3)])
        yield ([rng.randint(lo, hi) for _ in range(rng.randint(1, 300 if rng.random() < 0.5 else 10))],)


def maximal_rect_cases(rng):
    example = [["1", "0", "1", "0", "0"], ["1", "0", "1", "1", "1"], ["1", "1", "1", "1", "1"], ["1", "0", "0", "1", "0"]]
    yield from [(example,), ([["0"]],), ([["1"]],), ([["0", "1"], ["1", "0"]],)]
    while True:
        if rng.random() < 0.15:
            m, n = (1, rng.randint(1, 200)) if rng.random() < 0.5 else (rng.randint(1, 200), 1)
        else:
            m, n = rng.randint(1, 12), rng.randint(1, 12)
        density = rng.choice([0.3, 0.6, 0.85])
        yield ([["1" if rng.random() < density else "0" for _ in range(n)] for _ in range(m)],)


def min_cut_cases(rng):
    yield from [("aab",), ("a",), ("ab",), ("aaaa",), ("abacaba",), ("cabababcbc",)]
    while True:
        yield (rand_str(rng, rng.randint(1, 120 if rng.random() < 0.4 else 15), rng.choice(["a", "ab", "abc", "abcdefgh"])),)


# ── specs ────────────────────────────────────────────────────────────────

SPECS = [
    P(slug="regular-expression-matching", title="Regular Expression Matching", number=10,
      topics=["string", "dynamic-programming", "recursion"],
      method="isMatch", params=[("s", "string"), ("p", "string")], ret="bool",
      description="""
Implement matching of a string s against a pattern p that supports two special characters:
- '.' matches any single character.
- '*' matches zero or more copies of the character (or '.') immediately before it.

The pattern must match the entire string, not just part of it. Return true if it does.

Constraints:
- 1 <= s.length <= 20
- 1 <= p.length <= 20
- s contains only lowercase English letters.
- p contains only lowercase English letters, '.', and '*'.
- Every '*' is preceded by a valid character to repeat.""",
      hints=["A '*' always belongs to the character before it, so read the pattern in units of one character with an optional star.",
             "Let match(i, j) mean s[i:] matches p[j:]. If p[j+1] is '*', either skip the unit (j + 2) or, when s[i] matches p[j], consume one character and stay on the unit (i + 1).",
             "Without a star, s[i] must match p[j] and both advance. Fill the table from the ends of both strings backwards."],
      templates=templates("isMatch(self, s: str, p: str) -> bool", "bool isMatch(string s, string p)",
                          "bool isMatch(char* s, char* p)", "boolean isMatch(String s, String p)"),
      oracle=lambda s, p: re.fullmatch(p, s) is not None, cases=regex_cases),

    P(slug="wildcard-matching", title="Wildcard Matching", number=44,
      topics=["string", "dynamic-programming", "greedy", "recursion"],
      method="isMatch", params=[("s", "string"), ("p", "string")], ret="bool",
      description="""
Implement wildcard matching of a string s against a pattern p, where:
- '?' matches any single character.
- '*' matches any sequence of characters, including the empty sequence.

The pattern must cover the entire string. Return true if it matches.

Constraints:
- 0 <= s.length, p.length <= 2000
- s contains only lowercase English letters.
- p contains only lowercase English letters, '?' or '*'.""",
      hints=["A DP table where dp[i][j] means s[:i] matches p[:j] works in O(m * n).",
             "A '*' can match nothing (skip it in the pattern) or swallow one more character of s (stay on it).",
             "There is also a greedy approach: remember the position of the last '*' and, on a mismatch, backtrack so that star absorbs one more character."],
      templates=templates("isMatch(self, s: str, p: str) -> bool", "bool isMatch(string s, string p)",
                          "bool isMatch(char* s, char* p)", "boolean isMatch(String s, String p)"),
      oracle=lambda s, p: fnmatch.fnmatchcase(s, p), cases=wildcard_cases),

    P(slug="first-missing-positive", title="First Missing Positive", number=41,
      topics=["array", "hash-table"],
      method="firstMissingPositive", params=[("nums", "int[]")], ret="int",
      description="""
Given an unsorted integer array nums, return the smallest positive integer that does not appear in nums.

Your algorithm must run in O(n) time and use O(1) auxiliary space.

Constraints:
- 1 <= nums.length <= 10^5
- -2^31 <= nums[i] <= 2^31 - 1""",
      hints=["For an array of length n, the answer is always somewhere in 1 .. n + 1.",
             "That means values outside 1 .. n can be ignored, and each useful value v has a natural home at index v - 1.",
             "Swap every value into its home (skipping duplicates), then scan for the first index i where nums[i] != i + 1."],
      templates=templates("firstMissingPositive(self, nums: List[int]) -> int", "int firstMissingPositive(vector<int>& nums)",
                          "int firstMissingPositive(int* nums, int numsSize)", "int firstMissingPositive(int[] nums)"),
      oracle=lambda nums: next(i for i in range(1, len(nums) + 2) if i not in set(nums)), cases=first_missing_cases),

    P(slug="sliding-window-maximum", title="Sliding Window Maximum", number=239,
      topics=["array", "queue", "sliding-window", "heap-priority-queue", "monotonic-queue"],
      method="maxSlidingWindow", params=[("nums", "int[]"), ("k", "int")], ret="int[]",
      description="""
You are given an integer array nums and a window of size k that starts at the left end and slides one position to the right at a time until it reaches the right end.

Return an array containing the maximum value inside the window at each position.

Constraints:
- 1 <= nums.length <= 10^5
- -10^4 <= nums[i] <= 10^4
- 1 <= k <= nums.length""",
      hints=["Recomputing the maximum of every window costs O(n * k).",
             "An element that is smaller than a newer element can never again be a window maximum.",
             "Keep a deque of indices whose values decrease from front to back: pop smaller values from the back on insert, and pop the front once it leaves the window."],
      templates=templates("maxSlidingWindow(self, nums: List[int], k: int) -> List[int]",
                          "vector<int> maxSlidingWindow(vector<int>& nums, int k)",
                          "int* maxSlidingWindow(int* nums, int numsSize, int k, int* returnSize)",
                          "int[] maxSlidingWindow(int[] nums, int k)", c_note=C_ARR_NOTE),
      oracle=lambda nums, k: [max(nums[i:i + k]) for i in range(len(nums) - k + 1)], cases=window_cases),

    P(slug="word-ladder", title="Word Ladder", number=127,
      topics=["hash-table", "string", "breadth-first-search"],
      method="ladderLength", params=[("beginWord", "string"), ("endWord", "string"), ("wordList", "string[]")], ret="int",
      description="""
A transformation sequence from beginWord to endWord is a list of words that starts with beginWord and ends with endWord, where each consecutive pair of words differs in exactly one letter, and every word after beginWord appears in wordList. beginWord itself does not need to be in wordList.

Return the number of words in the shortest such sequence, or 0 if none exists.

Constraints:
- 1 <= beginWord.length <= 10
- endWord.length == beginWord.length
- 1 <= wordList.length <= 5000
- wordList[i].length == beginWord.length
- beginWord, endWord, and wordList[i] consist of lowercase English letters.
- beginWord != endWord
- All the words in wordList are unique.""",
      hints=["Treat each word as a graph node, with edges between words that differ in exactly one letter.",
             "The shortest sequence is a shortest path, so use breadth-first search starting at beginWord.",
             "Rather than comparing every pair of words, generate the neighbours of a word by changing one letter at a time and looking each candidate up in a hash set."],
      templates=templates("ladderLength(self, beginWord: str, endWord: str, wordList: List[str]) -> int",
                          "int ladderLength(string beginWord, string endWord, vector<string>& wordList)",
                          "int ladderLength(char* beginWord, char* endWord, char** wordList, int wordListSize)",
                          "int ladderLength(String beginWord, String endWord, List<String> wordList)"),
      oracle=ladder_oracle, cases=ladder_cases),

    P(slug="binary-tree-maximum-path-sum", title="Binary Tree Maximum Path Sum", number=124,
      topics=["dynamic-programming", "tree", "depth-first-search", "binary-tree"],
      method="maxPathSum", params=[("root", "TreeNode")], ret="int",
      description="""
A path in a binary tree is a sequence of nodes where each adjacent pair is connected by an edge, and no node appears more than once. A path must contain at least one node and does not need to pass through the root.

The sum of a path is the sum of its node values. Given the root of a binary tree, return the maximum sum over all paths.

Constraints:
- The number of nodes in the tree is in the range [1, 3 * 10^4].
- -1000 <= Node.val <= 1000""",
      hints=["Every path has one highest node, where it may turn from the left subtree into the right subtree.",
             "For each node compute its best downward gain: its value plus the larger of its children's gains, treating negative gains as 0.",
             "At each node, the best path turning there is value + left gain + right gain; track the maximum over all nodes while returning only the one-sided gain upward."],
      templates=templates("maxPathSum(self, root: Optional[TreeNode]) -> int", "int maxPathSum(TreeNode* root)",
                          "int maxPathSum(struct TreeNode* root)", "int maxPathSum(TreeNode root)", header="tree"),
      oracle=max_path_oracle, cases=max_path_cases),

    P(slug="reverse-nodes-in-k-group", title="Reverse Nodes in k-Group", number=25,
      topics=["linked-list", "recursion"],
      method="reverseKGroup", params=[("head", "ListNode"), ("k", "int")], ret="ListNode",
      description="""
Given the head of a linked list and a positive integer k, reverse the nodes of the list k at a time and return the modified list. If the number of nodes left at the end is less than k, those nodes keep their original order.

You must change the links between nodes, not just the values stored in them.

Follow-up: can you do it with O(1) extra memory?

Constraints:
- The number of nodes in the list is n.
- 1 <= k <= n <= 5000
- 0 <= Node.val <= 1000""",
      hints=["Before reversing a group, check that k nodes actually remain.",
             "Reverse a group with the usual three-pointer technique, but start the reversed tail pointing at the node after the group.",
             "Keep a pointer to the node just before the current group (a dummy head helps) so you can attach the new group head and move on."],
      templates=templates("reverseKGroup(self, head: Optional[ListNode], k: int) -> Optional[ListNode]",
                          "ListNode* reverseKGroup(ListNode* head, int k)",
                          "struct ListNode* reverseKGroup(struct ListNode* head, int k)",
                          "ListNode reverseKGroup(ListNode head, int k)", header="list"),
      oracle=reverse_k_oracle, cases=reverse_k_cases),

    P(slug="longest-increasing-path-in-a-matrix", title="Longest Increasing Path in a Matrix", number=329,
      topics=["array", "dynamic-programming", "depth-first-search", "breadth-first-search", "graph", "topological-sort", "memoization", "matrix"],
      method="longestIncreasingPath", params=[("matrix", "int[][]")], ret="int",
      description="""
Given an m x n integer matrix, return the length of the longest strictly increasing path. From any cell you may move up, down, left or right, but not diagonally and not outside the matrix.

Constraints:
- m == matrix.length
- n == matrix[i].length
- 1 <= m, n <= 200
- 0 <= matrix[i][j] <= 2^31 - 1""",
      hints=["A strictly increasing path can never revisit a cell, so there are no cycles to worry about.",
             "The longest path starting at a cell depends only on the longest paths starting at its larger neighbours.",
             "Memoise a DFS over cells, so each cell's answer is computed once and the whole matrix takes O(m * n)."],
      templates=templates("longestIncreasingPath(self, matrix: List[List[int]]) -> int",
                          "int longestIncreasingPath(vector<vector<int>>& matrix)",
                          "int longestIncreasingPath(int** matrix, int matrixSize, int* matrixColSize)",
                          "int longestIncreasingPath(int[][] matrix)"),
      oracle=lip_oracle, cases=lip_cases),

    P(slug="burst-balloons", title="Burst Balloons", number=312,
      topics=["array", "dynamic-programming"],
      method="maxCoins", params=[("nums", "int[]")], ret="int",
      description="""
There are n balloons in a row, and balloon i shows the number nums[i]. You burst the balloons one at a time. Bursting balloon i earns nums[left] * nums[i] * nums[right] coins, where left and right are the balloons currently adjacent to it. If there is no balloon on a side, that side counts as a 1.

Return the maximum number of coins you can collect by bursting every balloon.

Constraints:
- n == nums.length
- 1 <= n <= 300
- 0 <= nums[i] <= 100""",
      hints=["Choosing which balloon to burst first is hard, because the neighbours keep changing afterwards.",
             "Instead choose which balloon in a range is burst last: at that moment its neighbours are exactly the range's boundaries.",
             "Pad nums with a 1 on each side; best(l, r) over the open interval is the max over last in (l, r) of vals[l] * vals[last] * vals[r] + best(l, last) + best(last, r)."],
      templates=templates("maxCoins(self, nums: List[int]) -> int", "int maxCoins(vector<int>& nums)",
                          "int maxCoins(int* nums, int numsSize)", "int maxCoins(int[] nums)"),
      oracle=burst_oracle, cases=burst_cases),

    P(slug="distinct-subsequences", title="Distinct Subsequences", number=115,
      topics=["string", "dynamic-programming"],
      method="numDistinct", params=[("s", "string"), ("t", "string")], ret="int",
      description="""
Given two strings s and t, return the number of distinct ways to choose a subsequence of s that is equal to t. Two ways are distinct when they use a different set of positions in s.

The tests guarantee that the answer fits in a 32-bit signed integer.

Constraints:
- 1 <= s.length, t.length <= 1000
- s and t consist of English letters.""",
      hints=["Count matches of prefixes: let ways(i, j) be the number of ways the first i characters of s produce the first j characters of t.",
             "Character s[i-1] can always be skipped; if it equals t[j-1] it can also be used to match that character.",
             "Iterating j from right to left lets a single 1-D array hold the table; ways for the empty target is 1."],
      templates=templates("numDistinct(self, s: str, t: str) -> int", "int numDistinct(string s, string t)",
                          "int numDistinct(char* s, char* t)", "int numDistinct(String s, String t)"),
      oracle=distinct_oracle, cases=distinct_cases),

    P(slug="best-time-to-buy-and-sell-stock-iv", title="Best Time to Buy and Sell Stock IV", number=188,
      topics=["array", "dynamic-programming"],
      method="maxProfit", params=[("k", "int"), ("prices", "int[]")], ret="int",
      description="""
You are given an integer k and an array prices where prices[i] is a stock's price on day i. You may complete at most k transactions, where a transaction is one buy followed later by one sell. You can hold at most one share at a time, so you must sell before buying again.

Return the maximum profit you can achieve.

Constraints:
- 1 <= k <= 100
- 1 <= prices.length <= 1000
- 0 <= prices[i] <= 1000""",
      hints=["Track, for each transaction count t, the best cash position while holding a share and while not holding one.",
             "On each day, buy[t] = max(buy[t], sell[t-1] - price) and sell[t] = max(sell[t], buy[t] + price).",
             "If k is at least half the number of days, the limit never binds and you can simply take every upward price move."],
      templates=templates("maxProfit(self, k: int, prices: List[int]) -> int", "int maxProfit(int k, vector<int>& prices)",
                          "int maxProfit(int k, int* prices, int pricesSize)", "int maxProfit(int k, int[] prices)"),
      oracle=stock_k_oracle, cases=stock_k_cases),

    P(slug="candy", title="Candy", number=135,
      topics=["array", "greedy"],
      method="candy", params=[("ratings", "int[]")], ret="int",
      description="""
Children stand in a line, and ratings[i] is the rating of child i. You hand out candies so that:
- every child receives at least one candy, and
- a child with a strictly higher rating than an adjacent child receives more candies than that neighbour.

Return the minimum total number of candies needed.

Constraints:
- n == ratings.length
- 1 <= n <= 2 * 10^4
- 0 <= ratings[i] <= 2 * 10^4""",
      hints=["Handle the two neighbour constraints separately.",
             "A left-to-right pass fixes every child relative to the left neighbour; a right-to-left pass fixes them relative to the right neighbour.",
             "In the second pass, take the maximum of the current count and right neighbour + 1, so the first pass's constraint stays satisfied."],
      templates=templates("candy(self, ratings: List[int]) -> int", "int candy(vector<int>& ratings)",
                          "int candy(int* ratings, int ratingsSize)", "int candy(int[] ratings)"),
      oracle=candy_oracle, cases=candy_cases),

    P(slug="basic-calculator", title="Basic Calculator", number=224,
      topics=["math", "string", "stack", "recursion"],
      method="calculate", params=[("s", "string")], ret="int",
      description="""
Given a string s holding a valid arithmetic expression, evaluate it and return the result. You may not use any built-in function that evaluates strings as expressions.

The expression contains non-negative integers, '+', '-', parentheses and spaces. '-' may be used as a unary minus (as in "-1" or "-(2 + 3)"), but '+' is never unary. There are no two consecutive operators, and every intermediate result fits in a 32-bit integer.

Constraints:
- 1 <= s.length <= 3 * 10^5
- s consists of digits, '+', '-', '(', ')', and ' '.
- s represents a valid expression.""",
      hints=["Without parentheses, keep a running total and apply each number with the sign that precedes it.",
             "Multi-digit numbers must be accumulated character by character; spaces are simply skipped.",
             "On '(' push the current total and sign onto a stack and start fresh; on ')' finish the inner total and combine it with the saved total and sign."],
      templates=templates("calculate(self, s: str) -> int", "int calculate(string s)",
                          "int calculate(char* s)", "int calculate(String s)"),
      oracle=calculator_oracle, cases=calculator_cases),

    P(slug="count-of-smaller-numbers-after-self", title="Count of Smaller Numbers After Self", number=315,
      topics=["array", "binary-search", "divide-and-conquer", "binary-indexed-tree", "segment-tree", "merge-sort"],
      method="countSmaller", params=[("nums", "int[]")], ret="int[]",
      description="""
Given an integer array nums, return an array counts where counts[i] is the number of elements to the right of nums[i] that are strictly smaller than nums[i].

Constraints:
- 1 <= nums.length <= 10^5
- -10^4 <= nums[i] <= 10^4""",
      hints=["Comparing every pair is O(n^2).",
             "Walk from right to left, maintaining a structure over the values already seen that can count how many are below a threshold.",
             "The value range is small, so a Fenwick (binary indexed) tree over shifted values answers each count and insertion in O(log range); a merge sort that counts right-to-left crossings also works."],
      templates=templates("countSmaller(self, nums: List[int]) -> List[int]", "vector<int> countSmaller(vector<int>& nums)",
                          "int* countSmaller(int* nums, int numsSize, int* returnSize)", "List<Integer> countSmaller(int[] nums)",
                          c_note=C_ARR_NOTE),
      oracle=lambda nums: [sum(1 for w in nums[i + 1:] if w < v) for i, v in enumerate(nums)], cases=count_smaller_cases),

    P(slug="maximal-rectangle", title="Maximal Rectangle", number=85,
      topics=["array", "dynamic-programming", "stack", "matrix", "monotonic-stack"],
      method="maximalRectangle", params=[("matrix", "char[][]")], ret="int",
      description="""
You are given a rows x cols binary matrix of the characters '0' and '1'. Find the largest axis-aligned rectangle made up only of '1' cells and return its area.

Constraints:
- rows == matrix.length
- cols == matrix[i].length
- 1 <= rows, cols <= 200
- matrix[i][j] is '0' or '1'.""",
      hints=["Fix a row as the bottom edge. Above each column, the run of consecutive 1s ending at that row forms a bar of a histogram.",
             "The histogram for the next row is easy to update: a '1' extends the bar, a '0' resets it to 0.",
             "Solve largest-rectangle-in-histogram for every row with a monotonic stack; the overall answer is the best over all rows."],
      templates=templates("maximalRectangle(self, matrix: List[List[str]]) -> int", "int maximalRectangle(vector<vector<char>>& matrix)",
                          "int maximalRectangle(char** matrix, int matrixSize, int* matrixColSize)",
                          "int maximalRectangle(char[][] matrix)"),
      oracle=maximal_rect_oracle, cases=maximal_rect_cases),

    P(slug="palindrome-partitioning-ii", title="Palindrome Partitioning II", number=132,
      topics=["string", "dynamic-programming"],
      method="minCut", params=[("s", "string")], ret="int",
      description="""
Given a string s, split it into pieces so that every piece is a palindrome. Return the minimum number of cuts needed.

Constraints:
- 1 <= s.length <= 2000
- s consists of lowercase English letters only.""",
      hints=["Let cuts[i] be the minimum cuts for the prefix of length i; the answer is cuts[n].",
             "cuts[i] = min over palindromic s[j:i] of cuts[j] + 1, with cuts[0] = -1 so a whole-prefix palindrome needs 0 cuts.",
             "Avoid rechecking substrings: expand around every centre, and each palindrome s[l..r] found relaxes cuts[r + 1] from cuts[l]. That is O(n^2) overall."],
      templates=templates("minCut(self, s: str) -> int", "int minCut(string s)", "int minCut(char* s)", "int minCut(String s)"),
      oracle=min_cut_oracle, cases=min_cut_cases),
]


if __name__ == "__main__":
    write_all(SPECS)
