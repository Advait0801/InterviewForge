"""Phase 7 batch 2a: 23 medium problems (lists, backtracking, grids, DP, intervals).

    python scripts/problemgen/batch2a_medium.py

Same rules as batch 1: statements in our own words, LeetCode's signatures,
company tags from curation.py, and oracles that share no logic with the reference
solutions (brute force, itertools, big-integer arithmetic, O(n^2) DP where the
reference is greedy or O(n log n)).
"""
from __future__ import annotations

import itertools
import math
import os
import sys
from functools import lru_cache

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import C_ARR2_NOTE, C_ARR_NOTE, rand_str, templates, write_all  # noqa: E402

INT_MAX = 2**31 - 1


def P(**spec):
    spec.setdefault("difficulty", "medium")
    return spec


# ── oracles ──────────────────────────────────────────────────────────────

def add_two_oracle(l1, l2):
    total = int("".join(map(str, reversed(l1)))) + int("".join(map(str, reversed(l2))))
    return [int(d) for d in reversed(str(total))]


def valid_parens(s):
    depth = 0
    for ch in s:
        depth += 1 if ch == "(" else -1
        if depth < 0:
            return False
    return depth == 0


def generate_parens_oracle(n):
    return sorted("".join(p) for p in itertools.product("()", repeat=2 * n) if valid_parens(p))


def subsets_oracle(nums):
    return [sorted(c) for k in range(len(nums) + 1) for c in itertools.combinations(nums, k)]


def combination_sum_oracle(candidates, target):
    ways = [set() for _ in range(target + 1)]
    ways[0].add(())
    for t in range(1, target + 1):
        for c in candidates:
            if c <= t:
                for tup in ways[t - c]:
                    ways[t].add(tuple(sorted(tup + (c,))))
    return sorted(list(t) for t in ways[target])


PHONE = {"2": "abc", "3": "def", "4": "ghi", "5": "jkl", "6": "mno", "7": "pqrs", "8": "tuv", "9": "wxyz"}


def letter_oracle(digits):
    if not digits:
        return []
    return ["".join(p) for p in itertools.product(*(PHONE[d] for d in digits))]


def word_search_oracle(board, word):
    rows, cols = len(board), len(board[0])
    stack = [((r, c),) for r in range(rows) for c in range(cols) if board[r][c] == word[0]]
    while stack:
        path = stack.pop()
        if len(path) == len(word):
            return True
        r, c = path[-1]
        for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if 0 <= nr < rows and 0 <= nc < cols and (nr, nc) not in path and board[nr][nc] == word[len(path)]:
                stack.append(path + ((nr, nc),))
    return False


def spiral_oracle(matrix):
    out, m = [], [list(row) for row in matrix]
    while m:
        out.extend(m.pop(0))
        m = [list(row) for row in zip(*m)][::-1]  # rotate the remainder counter-clockwise
    return out


def set_zeroes_oracle(matrix):
    zr = {r for r, row in enumerate(matrix) for v in row if v == 0}
    zc = {c for row in matrix for c, v in enumerate(row) if v == 0}
    return [[0 if r in zr or c in zc else v for c, v in enumerate(row)] for r, row in enumerate(matrix)]


def can_jump_oracle(nums):
    reach = [False] * len(nums)
    reach[0] = True
    for i in range(len(nums)):
        if reach[i]:
            for j in range(i + 1, min(len(nums), i + nums[i] + 1)):
                reach[j] = True
    return reach[-1]


def lis_oracle(nums):
    best = [1] * len(nums)
    for i in range(len(nums)):
        for j in range(i):
            if nums[j] < nums[i]:
                best[i] = max(best[i], best[j] + 1)
    return max(best)


def rob_oracle(nums):
    @lru_cache(maxsize=None)
    def go(i):
        return 0 if i >= len(nums) else max(go(i + 1), nums[i] + go(i + 2))
    return go(0)


def rob2_oracle(nums):
    if len(nums) == 1:
        return nums[0]
    return max(rob_oracle(nums[1:]), rob_oracle(nums[:-1]))


def decode_counts(s):
    counts = [1] + [0] * len(s)
    for i in range(1, len(s) + 1):
        if s[i - 1] != "0":
            counts[i] += counts[i - 1]
        if i >= 2 and 10 <= int(s[i - 2:i]) <= 26:
            counts[i] += counts[i - 2]
    return counts


def partition_oracle(nums):
    total = sum(nums)
    if total % 2:
        return False
    sums = {0}
    for v in nums:
        sums |= {s + v for s in sums}
    return total // 2 in sums


def lcs_oracle(a, b):
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            dp[i][j] = dp[i - 1][j - 1] + 1 if a[i - 1] == b[j - 1] else max(dp[i - 1][j], dp[i][j - 1])
    return dp[-1][-1]


def merge_oracle(intervals):
    # Paint doubled coordinates, then read back the painted runs. Doubling keeps
    # [1,2] and [3,4] apart (4 and 6 are not adjacent) while [1,2],[2,3] touch.
    painted = set()
    for a, b in intervals:
        painted.update(range(2 * a, 2 * b + 1))
    out, points = [], sorted(painted)
    start = prev = points[0]
    for p in points[1:]:
        if p != prev + 1:
            out.append([start // 2, prev // 2])
            start = p
        prev = p
    out.append([start // 2, prev // 2])
    return out


def non_overlap_oracle(intervals):
    ivs = sorted(intervals)
    keep = [1] * len(ivs)
    for i in range(len(ivs)):
        for j in range(i):
            if ivs[j][1] <= ivs[i][0]:
                keep[i] = max(keep[i], keep[j] + 1)
    return len(ivs) - max(keep)


# ── case generators ──────────────────────────────────────────────────────

def digits_list(rng, n):
    if n == 1:
        return [rng.randint(0, 9)]
    return [rng.randint(0, 9) for _ in range(n - 1)] + [rng.randint(1, 9)]


def add_two_cases(rng):
    yield from [([2, 4, 3], [5, 6, 4]), ([0], [0]), ([9, 9, 9, 9, 9, 9, 9], [9, 9, 9, 9]), ([1], [9, 9])]
    while True:
        yield (digits_list(rng, rng.randint(1, 100 if rng.random() < 0.3 else 6)),
               digits_list(rng, rng.randint(1, 100 if rng.random() < 0.3 else 6)))


def remove_nth_cases(rng):
    yield from [([1, 2, 3, 4, 5], 2), ([1], 1), ([1, 2], 1), ([1, 2], 2)]
    while True:
        n = rng.randint(1, 30)
        yield ([rng.randint(0, 100) for _ in range(n)], rng.randint(1, n))


def matrix_search_cases(rng):
    base = [[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]]
    yield from [(base, 3), (base, 13), ([[1]], 1), ([[1]], 2), (base, 60), (base, 0)]
    while True:
        m, n = rng.randint(1, 20), rng.randint(1, 20)
        values = sorted(rng.sample(range(-10000, 10001), m * n))
        matrix = [values[r * n:(r + 1) * n] for r in range(m)]
        target = rng.choice(values) if rng.random() < 0.5 else rng.randint(-10000, 10000)
        yield (matrix, target)


def rotated_cases(rng):
    yield from [([3, 4, 5, 1, 2],), ([4, 5, 6, 7, 0, 1, 2],), ([11, 13, 15, 17],), ([1],), ([2, 1],)]
    while True:
        nums = sorted(rng.sample(range(-5000, 5001), rng.randint(1, 300 if rng.random() < 0.5 else 8)))
        k = rng.randrange(len(nums))
        yield (nums[k:] + nums[:k],)


def kth_cases(rng):
    yield from [([3, 2, 1, 5, 6, 4], 2), ([3, 2, 3, 1, 2, 4, 5, 5, 6], 4), ([1], 1), ([2, 1], 2)]
    while True:
        nums = [rng.randint(-10000, 10000) if rng.random() < 0.5 else rng.randint(-5, 5)
                for _ in range(rng.randint(1, 300 if rng.random() < 0.5 else 10))]
        yield (nums, rng.randint(1, len(nums)))


def subsets_cases(rng):
    yield from [([1, 2, 3],), ([0],), ([-1, 5],)]
    while True:
        yield (rng.sample(range(-10, 11), rng.randint(1, 10)),)


def combination_sum_cases(rng):
    yield from [([2, 3, 6, 7], 7), ([2, 3, 5], 8), ([2], 1), ([7, 3, 2], 18)]
    while True:
        cands = rng.sample(range(2, 41), rng.randint(1, 30 if rng.random() < 0.3 else 5))
        target = rng.randint(1, 40)
        if len(combination_sum_oracle(cands, target)) < 150:
            yield (cands, target)


def letter_cases(rng):
    yield from [("23",), ("",), ("2",), ("79",)]
    while True:
        yield ("".join(rng.choice("23456789") for _ in range(rng.randint(1, 4))),)


def word_search_cases(rng):
    board = [["A", "B", "C", "E"], ["S", "F", "C", "S"], ["A", "D", "E", "E"]]
    yield from [(board, "ABCCED"), (board, "SEE"), (board, "ABCB"), ([["a"]], "a"), ([["a", "b"]], "ba")]
    while True:
        m, n = rng.randint(1, 6), rng.randint(1, 6)
        alpha = rng.choice(["abc", "abcd", "abcdef", "ABCab"])
        grid = [[rng.choice(alpha) for _ in range(n)] for _ in range(m)]
        roll = rng.random()
        if roll < 0.75:
            # Walk a real path. Self-avoiding walks give words that exist; walks that may
            # revisit cells give words that usually exist only if a cell is reused. Without
            # the latter, a search that allowed reuse passed 49/50.
            reuse = roll < 0.3
            r, c = rng.randrange(m), rng.randrange(n)
            path = [(r, c)]
            for _ in range(rng.randint(2 if reuse else 0, 9)):
                steps = [(r + dr, c + dc) for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1))
                         if 0 <= r + dr < m and 0 <= c + dc < n and (reuse or (r + dr, c + dc) not in path)]
                if not steps:
                    break
                r, c = rng.choice(steps)
                path.append((r, c))
            word = "".join(grid[r][c] for r, c in path)
        else:
            word = rand_str(rng, rng.randint(1, 10), alpha)
        yield (grid, word)


def matrix_cases(rng, fixed, max_side, lo, hi, zero_bias=0.0):
    yield from fixed
    while True:
        m, n = rng.randint(1, max_side), rng.randint(1, max_side)
        yield ([[0 if rng.random() < zero_bias else rng.randint(lo, hi) for _ in range(n)] for _ in range(m)],)


def jump_cases(rng):
    yield from [([2, 3, 1, 1, 4],), ([3, 2, 1, 0, 4],), ([0],), ([0, 1],), ([1, 0],)]
    while True:
        n = rng.randint(1, 300 if rng.random() < 0.4 else 10)
        top = rng.choice([2, 3, 5, 100000])
        yield ([rng.randint(0, top) for _ in range(n)],)


def unique_paths_cases(rng):
    yield from [(3, 7), (3, 2), (1, 1), (1, 100), (100, 1), (17, 18)]
    while True:
        m, n = rng.randint(1, 100), rng.randint(1, 100 if rng.random() < 0.3 else 12)
        if math.comb(m + n - 2, m - 1) <= 2 * 10**9:
            yield (m, n)


def int_list_cases(rng, fixed, min_n, max_n, lo, hi):
    yield from fixed
    while True:
        yield ([rng.randint(lo, hi) for _ in range(rng.randint(min_n, max_n if rng.random() < 0.5 else min(max_n, 10)))],)


def lis_cases(rng):
    yield from [([10, 9, 2, 5, 3, 7, 101, 18],), ([0, 1, 0, 3, 2, 3],), ([7, 7, 7, 7, 7, 7, 7],), ([1],), ([1, 1, 2, 2, 3],)]
    while True:
        n = rng.randint(1, 300 if rng.random() < 0.5 else 10)
        # Narrow ranges force duplicates, which is exactly where strict and non-strict
        # differ; with wide ranges only, a bisect_right solution passed 49/50.
        lo, hi = (-10000, 10000) if rng.random() < 0.4 else (-3, 3)
        yield ([rng.randint(lo, hi) for _ in range(n)],)


def decode_cases(rng):
    yield from [("12",), ("226",), ("06",), ("0",), ("10",), ("2101",), ("27",), ("1111111111",)]
    while True:
        s = "".join(rng.choice(rng.choice(["12", "0126", "0123456789", "1234567"])) for _ in range(rng.randint(1, 100)))
        if max(decode_counts(s)) <= INT_MAX:
            yield (s,)


def partition_cases(rng):
    yield from [([1, 5, 11, 5],), ([1, 2, 3, 5],), ([1],), ([2, 2],), ([100, 100, 100, 100, 99, 97],)]
    while True:
        n = rng.randint(1, 100 if rng.random() < 0.4 else 8)
        nums = [rng.randint(1, 100 if rng.random() < 0.5 else 10) for _ in range(n)]
        if rng.random() < 0.3 and sum(nums) % 2:
            nums[0] += 1 if nums[0] < 100 else -1
        yield (nums,)


def lcs_cases(rng):
    yield from [("abcde", "ace"), ("abc", "abc"), ("abc", "def"), ("a", "a"), ("ab", "ba")]
    while True:
        alpha = "abcdefghijklmnopqrstuvwxyz"[: rng.randint(2, 26)]
        long_ = rng.random() < 0.3
        yield (rand_str(rng, rng.randint(1, 1000 if long_ else 12), alpha),
               rand_str(rng, rng.randint(1, 1000 if long_ else 12), alpha))


def interval_list(rng, n, hi):
    out = []
    for _ in range(n):
        a = rng.randint(0, hi)
        out.append([a, rng.randint(a, min(hi, a + max(1, hi // 5)))])
    return out


def merge_cases(rng):
    yield from [([[1, 3], [2, 6], [8, 10], [15, 18]],), ([[1, 4], [4, 5]],), ([[4, 7], [1, 4]],), ([[1, 1]],), ([[1, 2], [3, 4]],)]
    while True:
        hi = rng.choice([10, 50, 10000])
        yield (interval_list(rng, rng.randint(1, 200 if rng.random() < 0.3 else 8), hi),)


def insert_cases(rng):
    yield from [([[1, 3], [6, 9]], [2, 5]), ([[1, 2], [3, 5], [6, 7], [8, 10], [12, 16]], [4, 8]), ([], [5, 7]),
                ([[1, 5]], [2, 3]), ([[1, 5]], [6, 8]), ([[3, 5]], [1, 2])]
    while True:
        hi = rng.choice([20, 100, 100000])
        intervals = merge_oracle(interval_list(rng, rng.randint(1, 100 if rng.random() < 0.3 else 6), hi))
        # merge_oracle keeps touching intervals apart only when they do not share a point,
        # so the result is sorted and non-overlapping, as the problem requires.
        if rng.random() < 0.1:
            intervals = []
        if intervals and rng.random() < 0.4:
            # Span several existing intervals so the merge must swallow more than one;
            # otherwise merging only the first overlap passed 47/50.
            i = rng.randrange(len(intervals))
            j = rng.randrange(i, len(intervals))
            a = rng.randint(max(0, intervals[i][0] - 2), intervals[i][1])
            b = min(100000, rng.randint(intervals[j][0], intervals[j][1] + 2))
            yield (intervals, [a, max(a, b)])
            continue
        a = rng.randint(0, hi)
        yield (intervals, [a, rng.randint(a, min(hi, a + max(1, hi // 4)))])


def non_overlap_cases(rng):
    yield from [([[1, 2], [2, 3], [3, 4], [1, 3]],), ([[1, 2], [1, 2], [1, 2]],), ([[1, 2], [2, 3]],), ([[0, 5]],)]
    while True:
        n = rng.randint(1, 200 if rng.random() < 0.3 else 8)
        span = rng.choice([10, 100, 50000])
        out = []
        for _ in range(n):
            a = rng.randint(-span, span)
            out.append([a, rng.randint(a + 1, a + max(2, span // 4))])
        yield (out,)


# ── specs ────────────────────────────────────────────────────────────────

SPECS = [
    P(slug="add-two-numbers", title="Add Two Numbers", number=2,
      topics=["linked-list", "math", "recursion"],
      method="addTwoNumbers", params=[("l1", "ListNode"), ("l2", "ListNode")], ret="ListNode",
      description="""
Two non-negative integers are stored as non-empty linked lists, one digit per node, with the least significant digit first. Add the two numbers and return the sum in the same form.

Neither number has leading zeros, except the number 0 itself.

Constraints:
- The number of nodes in each list is in the range [1, 100].
- 0 <= Node.val <= 9
- Each list represents a number without leading zeros.""",
      hints=["The lists can hold 100 digits, far more than fits in any integer type, so add digit by digit.",
             "Because the lowest digit comes first, you can walk both lists together exactly as in column addition.",
             "Carry into the next node, keep going while either list has nodes or the carry is non-zero, and use a dummy head to simplify building the result."],
      templates=templates("addTwoNumbers(self, l1: Optional[ListNode], l2: Optional[ListNode]) -> Optional[ListNode]",
                          "ListNode* addTwoNumbers(ListNode* l1, ListNode* l2)",
                          "struct ListNode* addTwoNumbers(struct ListNode* l1, struct ListNode* l2)",
                          "ListNode addTwoNumbers(ListNode l1, ListNode l2)", header="list"),
      oracle=add_two_oracle, cases=add_two_cases),

    P(slug="generate-parentheses", title="Generate Parentheses", number=22, case_count=8, unorderedOutput=True,
      topics=["string", "dynamic-programming", "backtracking"],
      method="generateParenthesis", params=[("n", "int")], ret="string[]",
      description="""
Given n pairs of parentheses, return every string of length 2n made of '(' and ')' in which the parentheses are balanced and correctly nested. The strings may be returned in any order.

Constraints:
- 1 <= n <= 8""",
      hints=["Generating all 2^(2n) strings and filtering works for tiny n, but most of them are invalid.",
             "Build strings one character at a time and only take steps that can still lead to a valid result.",
             "You may add '(' while fewer than n have been used, and ')' only while it would close an open parenthesis."],
      templates=templates("generateParenthesis(self, n: int) -> List[str]", "vector<string> generateParenthesis(int n)",
                          "char** generateParenthesis(int n, int* returnSize)", "List<String> generateParenthesis(int n)",
                          c_note=C_ARR_NOTE),
      oracle=generate_parens_oracle, cases=lambda rng: iter([(n,) for n in [3, 1, 2, 4, 5, 6, 7, 8]])),

    P(slug="remove-nth-node-from-end-of-list", title="Remove Nth Node From End of List", number=19,
      topics=["linked-list", "two-pointers"],
      method="removeNthFromEnd", params=[("head", "ListNode"), ("n", "int")], ret="ListNode",
      description="""
Given the head of a linked list, remove the n-th node counted from the end of the list and return the head of the resulting list.

Follow-up: can you do it in a single pass?

Constraints:
- The number of nodes in the list is sz.
- 1 <= sz <= 30
- 0 <= Node.val <= 100
- 1 <= n <= sz""",
      hints=["Removing a node requires access to the node just before it, which is awkward when the head itself is removed.",
             "A dummy node in front of the head makes every removal look the same.",
             "Move a lead pointer n + 1 steps ahead of a trailing pointer, then advance both until the lead runs off the end; the trailing pointer is now just before the node to remove."],
      templates=templates("removeNthFromEnd(self, head: Optional[ListNode], n: int) -> Optional[ListNode]",
                          "ListNode* removeNthFromEnd(ListNode* head, int n)",
                          "struct ListNode* removeNthFromEnd(struct ListNode* head, int n)",
                          "ListNode removeNthFromEnd(ListNode head, int n)", header="list"),
      oracle=lambda head, n: head[:len(head) - n] + head[len(head) - n + 1:], cases=remove_nth_cases),

    P(slug="search-a-2d-matrix", title="Search a 2D Matrix", number=74,
      topics=["array", "binary-search", "matrix"],
      method="searchMatrix", params=[("matrix", "int[][]"), ("target", "int")], ret="bool",
      description="""
You are given an m x n integer matrix with two properties: every row is sorted in non-decreasing order, and the first value of each row is greater than the last value of the row above it.

Given an integer target, return true if target is in the matrix and false otherwise. Your solution must run in O(log(m * n)) time.

Constraints:
- m == matrix.length
- n == matrix[i].length
- 1 <= m, n <= 100
- -10^4 <= matrix[i][j], target <= 10^4""",
      hints=["Read row by row, the whole matrix is one sorted sequence of m * n values.",
             "Binary search over indices 0 .. m*n - 1 of that virtual sequence.",
             "Index k corresponds to matrix[k / n][k % n]."],
      templates=templates("searchMatrix(self, matrix: List[List[int]], target: int) -> bool",
                          "bool searchMatrix(vector<vector<int>>& matrix, int target)",
                          "bool searchMatrix(int** matrix, int matrixSize, int* matrixColSize, int target)",
                          "boolean searchMatrix(int[][] matrix, int target)"),
      oracle=lambda matrix, target: any(target in row for row in matrix), cases=matrix_search_cases),

    P(slug="find-minimum-in-rotated-sorted-array", title="Find Minimum in Rotated Sorted Array", number=153,
      topics=["array", "binary-search"],
      method="findMin", params=[("nums", "int[]")], ret="int",
      description="""
An array of unique integers, originally sorted in ascending order, has been rotated some number of times between 1 and n: rotating moves the last element to the front. For example [0,1,2,4,5,6,7] might become [4,5,6,7,0,1,2].

Given the rotated array nums, return its minimum element. Your algorithm must run in O(log n) time.

Constraints:
- n == nums.length
- 1 <= n <= 5000
- -5000 <= nums[i] <= 5000
- All the integers of nums are unique.
- nums is sorted and rotated between 1 and n times.""",
      hints=["The minimum is the only element smaller than the element before it.",
             "Compare the middle element with the last element of the current range: that tells you which side of the rotation point you are on.",
             "If nums[mid] > nums[hi], the minimum is strictly to the right of mid; otherwise it is at mid or to its left."],
      templates=templates("findMin(self, nums: List[int]) -> int", "int findMin(vector<int>& nums)",
                          "int findMin(int* nums, int numsSize)", "int findMin(int[] nums)"),
      oracle=lambda nums: min(nums), cases=rotated_cases),

    P(slug="kth-largest-element-in-an-array", title="Kth Largest Element in an Array", number=215,
      topics=["array", "divide-and-conquer", "sorting", "heap-priority-queue", "quickselect"],
      method="findKthLargest", params=[("nums", "int[]"), ("k", "int")], ret="int",
      description="""
Given an integer array nums and an integer k, return the k-th largest element in the array: the element that would be at position k if the array were sorted in descending order. Duplicates count separately.

Can you solve it without sorting the whole array?

Constraints:
- 1 <= k <= nums.length <= 10^5
- -10^4 <= nums[i] <= 10^4""",
      hints=["Sorting works in O(n log n), but you only need one position.",
             "A min-heap holding the k largest values seen so far has the answer at its top.",
             "Quickselect partitions around a pivot and recurses into only one side, giving O(n) on average; the small value range also allows counting."],
      templates=templates("findKthLargest(self, nums: List[int], k: int) -> int", "int findKthLargest(vector<int>& nums, int k)",
                          "int findKthLargest(int* nums, int numsSize, int k)", "int findKthLargest(int[] nums, int k)"),
      oracle=lambda nums, k: sorted(nums)[-k], cases=kth_cases),

    P(slug="subsets", title="Subsets", number=78, unorderedOutput=True, unorderedInner=True,
      topics=["array", "backtracking", "bit-manipulation"],
      method="subsets", params=[("nums", "int[]")], ret="int[][]",
      description="""
Given an integer array nums of unique elements, return every possible subset (the power set), including the empty set and nums itself.

The result must not contain duplicate subsets. Subsets may be returned in any order.

Constraints:
- 1 <= nums.length <= 10
- -10 <= nums[i] <= 10
- All the numbers of nums are unique.""",
      hints=["An array of n elements has exactly 2^n subsets: each element is either in or out.",
             "Treat an n-bit number as a membership mask and loop it from 0 to 2^n - 1.",
             "Alternatively backtrack: at each index, recurse once including the element and once excluding it."],
      templates=templates("subsets(self, nums: List[int]) -> List[List[int]]", "vector<vector<int>> subsets(vector<int>& nums)",
                          "int** subsets(int* nums, int numsSize, int* returnSize, int** returnColumnSizes)",
                          "List<List<Integer>> subsets(int[] nums)", c_note=C_ARR2_NOTE),
      oracle=subsets_oracle, cases=subsets_cases),

    P(slug="combination-sum", title="Combination Sum", number=39, unorderedOutput=True, unorderedInner=True,
      topics=["array", "backtracking"],
      method="combinationSum", params=[("candidates", "int[]"), ("target", "int")], ret="int[][]",
      description="""
You are given an array of distinct integers candidates and an integer target. Return every unique combination of candidates whose values add up to target. The same candidate may be used any number of times.

Two combinations are different when the count of at least one candidate differs. Combinations may be returned in any order. The tests guarantee fewer than 150 combinations for each input.

Constraints:
- 1 <= candidates.length <= 30
- 2 <= candidates[i] <= 40
- All elements of candidates are distinct.
- 1 <= target <= 40""",
      hints=["Picking candidates in any order produces duplicates such as [2,3] and [3,2].",
             "Enforce an order: once you move past a candidate, never pick it again.",
             "Backtrack with (start index, remaining target); try each candidate from start onward, recursing with the same index so it can be reused."],
      templates=templates("combinationSum(self, candidates: List[int], target: int) -> List[List[int]]",
                          "vector<vector<int>> combinationSum(vector<int>& candidates, int target)",
                          "int** combinationSum(int* candidates, int candidatesSize, int target, int* returnSize, int** returnColumnSizes)",
                          "List<List<Integer>> combinationSum(int[] candidates, int target)", c_note=C_ARR2_NOTE),
      oracle=combination_sum_oracle, cases=combination_sum_cases),

    P(slug="letter-combinations-of-a-phone-number", title="Letter Combinations of a Phone Number", number=17, unorderedOutput=True,
      topics=["hash-table", "string", "backtracking"],
      method="letterCombinations", params=[("digits", "string")], ret="string[]",
      description="""
On a classic phone keypad, each digit from 2 to 9 maps to letters: 2 -> abc, 3 -> def, 4 -> ghi, 5 -> jkl, 6 -> mno, 7 -> pqrs, 8 -> tuv, 9 -> wxyz.

Given a string digits, return every letter string that the digits could represent, choosing one letter per digit. Return them in any order. If digits is empty, return an empty list.

Constraints:
- 0 <= digits.length <= 4
- digits[i] is a digit in the range ['2', '9'].""",
      hints=["The answer is the Cartesian product of the letter groups of each digit.",
             "Build strings position by position: for each partial string, extend it with every letter of the next digit.",
             "Handle the empty input separately, since the product of zero groups would otherwise be one empty string."],
      templates=templates("letterCombinations(self, digits: str) -> List[str]", "vector<string> letterCombinations(string digits)",
                          "char** letterCombinations(char* digits, int* returnSize)", "List<String> letterCombinations(String digits)",
                          c_note=C_ARR_NOTE),
      oracle=letter_oracle, cases=letter_cases),

    P(slug="word-search", title="Word Search", number=79,
      topics=["array", "string", "backtracking", "depth-first-search", "matrix"],
      method="exist", params=[("board", "char[][]"), ("word", "string")], ret="bool",
      description="""
Given an m x n grid of characters board and a string word, return true if word can be traced through the grid.

A trace starts at any cell and moves step by step to a horizontally or vertically adjacent cell, reading one letter per cell. A cell may not be used more than once in the same trace.

Constraints:
- m == board.length
- n == board[i].length
- 1 <= m, n <= 6
- 1 <= word.length <= 15
- board and word consist of only lowercase and uppercase English letters.""",
      hints=["Every trace starts somewhere, so try each cell as a starting point.",
             "From a cell that matches the current letter, recurse into its neighbours for the next letter.",
             "Mark a cell as used before recursing (for example by overwriting it) and restore it afterwards so other traces can use it."],
      templates=templates("exist(self, board: List[List[str]], word: str) -> bool", "bool exist(vector<vector<char>>& board, string word)",
                          "bool exist(char** board, int boardSize, int* boardColSize, char* word)",
                          "boolean exist(char[][] board, String word)"),
      oracle=word_search_oracle, cases=word_search_cases),

    P(slug="spiral-matrix", title="Spiral Matrix", number=54,
      topics=["array", "matrix", "simulation"],
      method="spiralOrder", params=[("matrix", "int[][]")], ret="int[]",
      description="""
Given an m x n matrix, return all of its elements in spiral order: across the top row left to right, down the right column, across the bottom row right to left, up the left column, and then inwards in the same pattern.

Constraints:
- m == matrix.length
- n == matrix[i].length
- 1 <= m, n <= 10
- -100 <= matrix[i][j] <= 100""",
      hints=["Track four boundaries: top, bottom, left and right.",
             "Walk one side, then move that boundary inwards by one.",
             "Re-check that top <= bottom and left <= right before walking the bottom row and left column, or single rows and columns get read twice."],
      templates=templates("spiralOrder(self, matrix: List[List[int]]) -> List[int]", "vector<int> spiralOrder(vector<vector<int>>& matrix)",
                          "int* spiralOrder(int** matrix, int matrixSize, int* matrixColSize, int* returnSize)",
                          "List<Integer> spiralOrder(int[][] matrix)", c_note=C_ARR_NOTE),
      oracle=spiral_oracle,
      cases=lambda rng: matrix_cases(rng, [([[1, 2, 3], [4, 5, 6], [7, 8, 9]],), ([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]],),
                                           ([[1]],), ([[1, 2, 3]],), ([[1], [2], [3]],)], 10, -100, 100)),

    P(slug="set-matrix-zeroes", title="Set Matrix Zeroes", number=73,
      topics=["array", "hash-table", "matrix"],
      method="setZeroes", params=[("matrix", "int[][]")], ret="void",
      description="""
Given an m x n integer matrix, whenever an element is 0, set its entire row and its entire column to 0. Do this in place.

Only zeros that were in the original matrix trigger clearing; zeros you write do not spread further.

Follow-up: an O(m + n) extra-space solution is straightforward. Can you do it with O(1) extra space?

Constraints:
- m == matrix.length
- n == matrix[0].length
- 1 <= m, n <= 200
- -2^31 <= matrix[i][j] <= 2^31 - 1""",
      hints=["Clearing as soon as you see a zero makes the zeros you write look like original ones.",
             "First record which rows and which columns contain a zero, then clear them in a second pass.",
             "For O(1) space, use the first row and first column as the marker arrays, with one extra flag for whether the first column itself must be cleared."],
      templates=templates("setZeroes(self, matrix: List[List[int]]) -> None", "void setZeroes(vector<vector<int>>& matrix)",
                          "void setZeroes(int** matrix, int matrixSize, int* matrixColSize)", "void setZeroes(int[][] matrix)"),
      oracle=set_zeroes_oracle,
      cases=lambda rng: matrix_cases(rng, [([[1, 1, 1], [1, 0, 1], [1, 1, 1]],), ([[0, 1, 2, 0], [3, 4, 5, 2], [1, 3, 1, 5]],),
                                           ([[0]],), ([[1]],), ([[1, 0]],), ([[2147483647, -2147483648], [0, 5]],)],
                                     20, -2**31, 2**31 - 1, zero_bias=0.08)),

    P(slug="jump-game", title="Jump Game", number=55,
      topics=["array", "dynamic-programming", "greedy"],
      method="canJump", params=[("nums", "int[]")], ret="bool",
      description="""
You start at index 0 of an integer array nums. Each value nums[i] is the maximum number of positions you may jump forward from index i.

Return true if you can reach the last index, and false otherwise.

Constraints:
- 1 <= nums.length <= 10^4
- 0 <= nums[i] <= 10^5""",
      hints=["You only get stuck at a zero that nothing before it can jump over.",
             "Track the furthest index reachable so far as you scan left to right.",
             "If the current index is beyond that furthest reach, the end is unreachable; otherwise update the reach with i + nums[i]."],
      templates=templates("canJump(self, nums: List[int]) -> bool", "bool canJump(vector<int>& nums)",
                          "bool canJump(int* nums, int numsSize)", "boolean canJump(int[] nums)"),
      oracle=can_jump_oracle, cases=jump_cases),

    P(slug="unique-paths", title="Unique Paths", number=62,
      topics=["math", "dynamic-programming", "combinatorics"],
      method="uniquePaths", params=[("m", "int"), ("n", "int")], ret="int",
      description="""
A robot starts in the top-left cell of an m x n grid and wants to reach the bottom-right cell. At each step it may move only one cell right or one cell down.

Return the number of distinct paths it can take. The tests guarantee the answer is at most 2 * 10^9.

Constraints:
- 1 <= m, n <= 100""",
      hints=["The number of ways to reach a cell is the number of ways to reach the cell above it plus the cell to its left.",
             "The first row and first column each have exactly one path.",
             "A single row of size n updated in place is enough; or count directly as the binomial coefficient C(m + n - 2, m - 1)."],
      templates=templates("uniquePaths(self, m: int, n: int) -> int", "int uniquePaths(int m, int n)",
                          "int uniquePaths(int m, int n)", "int uniquePaths(int m, int n)"),
      oracle=lambda m, n: math.comb(m + n - 2, m - 1), cases=unique_paths_cases),

    P(slug="longest-increasing-subsequence", title="Longest Increasing Subsequence", number=300,
      topics=["array", "binary-search", "dynamic-programming"],
      method="lengthOfLIS", params=[("nums", "int[]")], ret="int",
      description="""
Given an integer array nums, return the length of its longest strictly increasing subsequence. A subsequence keeps the original order but may skip elements.

Follow-up: can you do better than O(n^2)?

Constraints:
- 1 <= nums.length <= 2500
- -10^4 <= nums[i] <= 10^4""",
      hints=["Let best[i] be the length of the longest increasing subsequence ending at index i; it extends some earlier best[j] with nums[j] < nums[i].",
             "That DP is O(n^2). For O(n log n), keep tails[k] = the smallest possible last value of an increasing subsequence of length k + 1.",
             "For each value, binary search tails for the first entry >= value and replace it (or append); the answer is the length of tails."],
      templates=templates("lengthOfLIS(self, nums: List[int]) -> int", "int lengthOfLIS(vector<int>& nums)",
                          "int lengthOfLIS(int* nums, int numsSize)", "int lengthOfLIS(int[] nums)"),
      oracle=lis_oracle, cases=lambda rng: lis_cases(rng)),

    P(slug="house-robber", title="House Robber", number=198,
      topics=["array", "dynamic-programming"],
      method="rob", params=[("nums", "int[]")], ret="int",
      description="""
Houses stand in a row, and nums[i] is the amount of money in house i. You may take money from any set of houses, but never from two adjacent houses, because that sets off an alarm.

Return the largest total amount you can take.

Constraints:
- 1 <= nums.length <= 100
- 0 <= nums[i] <= 400""",
      hints=["At each house there are only two choices: take it, or skip it.",
             "If you take house i you cannot have taken i - 1, so best(i) = max(best(i - 1), best(i - 2) + nums[i]).",
             "Only the previous two results are needed, so two variables replace the whole table."],
      templates=templates("rob(self, nums: List[int]) -> int", "int rob(vector<int>& nums)",
                          "int rob(int* nums, int numsSize)", "int rob(int[] nums)"),
      oracle=rob_oracle,
      cases=lambda rng: int_list_cases(rng, [([1, 2, 3, 1],), ([2, 7, 9, 3, 1],), ([0],), ([2, 1, 1, 2],)], 1, 100, 0, 400)),

    P(slug="house-robber-ii", title="House Robber II", number=213,
      topics=["array", "dynamic-programming"],
      method="rob", params=[("nums", "int[]")], ret="int",
      description="""
This is House Robber with one change: the houses stand in a circle, so the first and last houses are adjacent to each other. You still may not take money from two adjacent houses.

Given nums, the money in each house, return the largest total amount you can take.

Constraints:
- 1 <= nums.length <= 100
- 0 <= nums[i] <= 1000""",
      hints=["The only new constraint is that the first and last houses cannot both be taken.",
             "So at least one of them is skipped: solve the straight-line problem once without the first house and once without the last.",
             "The answer is the larger of the two, with a special case when there is only one house."],
      templates=templates("rob(self, nums: List[int]) -> int", "int rob(vector<int>& nums)",
                          "int rob(int* nums, int numsSize)", "int rob(int[] nums)"),
      oracle=rob2_oracle,
      cases=lambda rng: int_list_cases(rng, [([2, 3, 2],), ([1, 2, 3, 1],), ([1, 2, 3],), ([5],), ([1, 7],)], 1, 100, 0, 1000)),

    P(slug="decode-ways", title="Decode Ways", number=91,
      topics=["string", "dynamic-programming"],
      method="numDecodings", params=[("s", "string")], ret="int",
      description="""
Letters are encoded as numbers: 'A' -> "1", 'B' -> "2", ..., 'Z' -> "26". A string of digits can often be split back into letters in more than one way; for example "12" is either "AB" (1 2) or "L" (12).

A group is valid only if it is between "1" and "26" without a leading zero, so "06" cannot be read as 6.

Given a digit string s, return the number of ways to decode it, or 0 if it cannot be decoded. The tests guarantee the answer fits in a 32-bit integer.

Constraints:
- 1 <= s.length <= 100
- s contains only digits and may contain leading zero(s).""",
      hints=["The last letter of any decoding uses either the last one digit or the last two digits.",
             "ways(i) = ways(i - 1) if s[i-1] is not '0', plus ways(i - 2) if the two digits ending at i form a number from 10 to 26.",
             "Zeros are the trap: a '0' can only appear as the second digit of 10 or 20."],
      templates=templates("numDecodings(self, s: str) -> int", "int numDecodings(string s)",
                          "int numDecodings(char* s)", "int numDecodings(String s)"),
      oracle=lambda s: decode_counts(s)[-1], cases=decode_cases),

    P(slug="partition-equal-subset-sum", title="Partition Equal Subset Sum", number=416,
      topics=["array", "dynamic-programming"],
      method="canPartition", params=[("nums", "int[]")], ret="bool",
      description="""
Given an array of positive integers nums, return true if it can be split into two groups whose sums are equal, using every element exactly once. Otherwise return false.

Constraints:
- 1 <= nums.length <= 200
- 1 <= nums[i] <= 100""",
      hints=["If the total sum is odd, the answer is immediately false.",
             "Otherwise the question becomes: is there a subset that sums to exactly total / 2?",
             "Keep a boolean array reachable[s]; for each number, update it from high sums to low so each number is used at most once."],
      templates=templates("canPartition(self, nums: List[int]) -> bool", "bool canPartition(vector<int>& nums)",
                          "bool canPartition(int* nums, int numsSize)", "boolean canPartition(int[] nums)"),
      oracle=partition_oracle, cases=partition_cases),

    P(slug="longest-common-subsequence", title="Longest Common Subsequence", number=1143,
      topics=["string", "dynamic-programming"],
      method="longestCommonSubsequence", params=[("text1", "string"), ("text2", "string")], ret="int",
      description="""
Given two strings text1 and text2, return the length of their longest common subsequence, or 0 if they share none.

A subsequence keeps the characters of a string in their original order but may skip any of them; a common subsequence is one that both strings contain.

Constraints:
- 1 <= text1.length, text2.length <= 1000
- text1 and text2 consist of only lowercase English characters.""",
      hints=["Compare the strings prefix by prefix: let L(i, j) be the answer for the first i characters of text1 and the first j of text2.",
             "If text1[i-1] == text2[j-1], L(i, j) = L(i-1, j-1) + 1; otherwise it is max(L(i-1, j), L(i, j-1)).",
             "Filling the table row by row needs only the previous row, so O(min(m, n)) memory is enough."],
      templates=templates("longestCommonSubsequence(self, text1: str, text2: str) -> int",
                          "int longestCommonSubsequence(string text1, string text2)",
                          "int longestCommonSubsequence(char* text1, char* text2)",
                          "int longestCommonSubsequence(String text1, String text2)"),
      oracle=lcs_oracle, cases=lcs_cases),

    P(slug="merge-intervals", title="Merge Intervals", number=56, unorderedOutput=True,
      topics=["array", "sorting"],
      method="merge", params=[("intervals", "int[][]")], ret="int[][]",
      description="""
You are given an array of intervals where intervals[i] = [start_i, end_i]. Merge every group of overlapping intervals and return the resulting non-overlapping intervals, which together cover exactly the same points as the input.

Intervals that share an endpoint, such as [1,4] and [4,5], overlap. The result may be in any order.

Constraints:
- 1 <= intervals.length <= 10^4
- intervals[i].length == 2
- 0 <= start_i <= end_i <= 10^4""",
      hints=["Overlaps are hard to find in arbitrary order, but easy to see once the intervals are sorted.",
             "Sort by start time; each interval then either overlaps the last merged interval or starts a new one.",
             "It overlaps when its start is <= the last merged end, in which case extend that end to the maximum of the two."],
      templates=templates("merge(self, intervals: List[List[int]]) -> List[List[int]]",
                          "vector<vector<int>> merge(vector<vector<int>>& intervals)",
                          "int** merge(int** intervals, int intervalsSize, int* intervalsColSize, int* returnSize, int** returnColumnSizes)",
                          "int[][] merge(int[][] intervals)", c_note=C_ARR2_NOTE),
      oracle=merge_oracle, cases=merge_cases),

    P(slug="insert-interval", title="Insert Interval", number=57,
      topics=["array"],
      method="insert", params=[("intervals", "int[][]"), ("newInterval", "int[]")], ret="int[][]",
      description="""
You are given a list of non-overlapping intervals sorted by start, and one more interval newInterval. Insert newInterval so that the list is still sorted by start and still has no overlapping intervals, merging wherever necessary.

Return the resulting list. Intervals that share an endpoint count as overlapping.

Constraints:
- 0 <= intervals.length <= 10^4
- intervals[i].length == 2
- 0 <= start_i <= end_i <= 10^5
- intervals is sorted by start_i in ascending order.
- newInterval.length == 2
- 0 <= start <= end <= 10^5""",
      hints=["The input is already sorted and disjoint, so no sorting is needed.",
             "Split the list into three parts: intervals ending before newInterval starts, intervals that overlap it, and intervals starting after it ends.",
             "Copy the first part, merge the middle part into newInterval by widening its bounds, append it, then copy the last part."],
      templates=templates("insert(self, intervals: List[List[int]], newInterval: List[int]) -> List[List[int]]",
                          "vector<vector<int>> insert(vector<vector<int>>& intervals, vector<int>& newInterval)",
                          "int** insert(int** intervals, int intervalsSize, int* intervalsColSize, int* newInterval, int newIntervalSize, int* returnSize, int** returnColumnSizes)",
                          "int[][] insert(int[][] intervals, int[] newInterval)", c_note=C_ARR2_NOTE),
      oracle=lambda intervals, new: merge_oracle(intervals + [new]), cases=insert_cases),

    P(slug="non-overlapping-intervals", title="Non-overlapping Intervals", number=435,
      topics=["array", "dynamic-programming", "greedy", "sorting"],
      method="eraseOverlapIntervals", params=[("intervals", "int[][]")], ret="int",
      description="""
Given an array of intervals where intervals[i] = [start_i, end_i], return the minimum number of intervals you must remove so that the remaining intervals do not overlap.

Intervals that only touch at an endpoint, such as [1,2] and [2,3], do not overlap.

Constraints:
- 1 <= intervals.length <= 10^5
- intervals[i].length == 2
- -5 * 10^4 <= start_i < end_i <= 5 * 10^4""",
      hints=["Removing the fewest intervals is the same as keeping the most intervals that do not overlap.",
             "Among intervals that could come next, the one that ends earliest leaves the most room for the rest.",
             "Sort by end time and greedily keep each interval whose start is >= the end of the last kept interval; count the rest as removed."],
      templates=templates("eraseOverlapIntervals(self, intervals: List[List[int]]) -> int",
                          "int eraseOverlapIntervals(vector<vector<int>>& intervals)",
                          "int eraseOverlapIntervals(int** intervals, int intervalsSize, int* intervalsColSize)",
                          "int eraseOverlapIntervals(int[][] intervals)"),
      oracle=non_overlap_oracle, cases=non_overlap_cases),
]


if __name__ == "__main__":
    write_all(SPECS)
