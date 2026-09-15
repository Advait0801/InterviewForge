"""Phase 7 batch 1: the 31 easy problems.

    python scripts/problemgen/batch1_easy.py

Statements are written in our own words; the problems themselves (numbers,
titles, signatures, constraints) follow LeetCode, which is credited in the README.
Company tags live in curation.py, which overrides anything a spec would set.

Oracles are intentionally naive (sorting, Counter, brute force, Python's
standard library) so they share no logic with the reference solutions.
"""
from __future__ import annotations

import bisect
import math
import os
import sys
from collections import Counter, deque

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (  # noqa: E402
    C_ARR2_NOTE, C_ARR_NOTE, Node, mirror, rand_str, random_tree, skewed_tree,
    templates, tree_from_level, tree_to_level, write_all,
)

LOWER = "abcdefghijklmnopqrstuvwxyz"


def P(**spec):
    spec.setdefault("difficulty", "easy")
    return spec


def _tree_cases(rng, fixed, max_n, lo, hi, allow_empty=True):
    yield from fixed
    while True:
        roll = rng.random()
        n = rng.randint(0 if allow_empty else 1, max_n)
        if roll < 0.15:
            yield (tree_to_level(skewed_tree(rng, max(1, n // 3), lo, hi)),)
        elif roll < 0.35:
            yield (tree_to_level(random_tree(rng, rng.randint(1, 8), lo, hi)),)
        else:
            yield (tree_to_level(random_tree(rng, n, lo, hi)),)


def _list_cases(rng, fixed, max_n, lo, hi, min_n=0):
    yield from fixed
    while True:
        n = rng.randint(min_n, max_n if rng.random() < 0.5 else min(max_n, 12))
        yield ([rng.randint(lo, hi) for _ in range(n)],)


def _mutate_level(rng, arr, lo, hi):
    arr = list(arr)
    spots = [i for i, v in enumerate(arr) if v is not None]
    if spots:
        i = rng.choice(spots)
        arr[i] = arr[i] + rng.choice([-1, 1]) if lo <= arr[i] - 1 and arr[i] + 1 <= hi else lo if arr[i] != lo else hi
    return arr


def _height(node):
    if node is None:
        return 0
    queue, depth = deque([node]), 0
    while queue:
        depth += 1
        for _ in range(len(queue)):
            cur = queue.popleft()
            queue.extend(c for c in (cur.left, cur.right) if c)
    return depth


def _all_nodes(root):
    out, stack = [], [root] if root else []
    while stack:
        node = stack.pop()
        out.append(node)
        stack.extend(c for c in (node.left, node.right) if c)
    return out


# ── 1. valid anagram ─────────────────────────────────────────────────────

def anagram_cases(rng):
    yield from [("anagram", "nagaram"), ("rat", "car"), ("a", "a"), ("a", "b"), ("ab", "a"), ("aacc", "ccac")]
    while True:
        n = rng.randint(1, 1200 if rng.random() < 0.3 else 15)
        alpha = LOWER[: rng.randint(1, 26)]
        s = rand_str(rng, n, alpha)
        roll = rng.random()
        if roll < 0.5:
            t = "".join(rng.sample(s, len(s)))
        elif roll < 0.8:
            chars = list(rng.sample(s, len(s)))
            i = rng.randrange(len(chars))
            chars[i] = rng.choice([c for c in LOWER if c != chars[i]])
            t = "".join(chars)
        else:
            t = rand_str(rng, max(1, n + rng.randint(-2, 2)), alpha)
        yield (s, t)


# ── 12. roman to integer ─────────────────────────────────────────────────

_ROMAN_TOKENS = [("M", 1000), ("CM", 900), ("D", 500), ("CD", 400), ("C", 100), ("XC", 90),
                 ("L", 50), ("XL", 40), ("X", 10), ("IX", 9), ("V", 5), ("IV", 4), ("I", 1)]


def to_roman(n):
    out = ""
    for sym, val in _ROMAN_TOKENS:
        while n >= val:
            out += sym
            n -= val
    return out


def roman_oracle(s):
    total, i = 0, 0
    while i < len(s):
        for sym, val in _ROMAN_TOKENS:
            if s.startswith(sym, i):
                total += val
                i += len(sym)
                break
        else:
            raise ValueError(s)
    assert to_roman(total) == s
    return total


# ── 30/31. grids ─────────────────────────────────────────────────────────

def flood_oracle(image, sr, sc, color):
    start = image[sr][sc]
    if start == color:
        return image
    rows, cols = len(image), len(image[0])
    queue, image[sr][sc] = deque([(sr, sc)]), color
    while queue:
        r, c = queue.popleft()
        for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if 0 <= nr < rows and 0 <= nc < cols and image[nr][nc] == start:
                image[nr][nc] = color
                queue.append((nr, nc))
    return image


def flood_cases(rng):
    yield from [([[1, 1, 1], [1, 1, 0], [1, 0, 1]], 1, 1, 2), ([[0, 0, 0], [0, 0, 0]], 0, 0, 0), ([[0]], 0, 0, 5)]
    while True:
        rows, cols = rng.randint(1, 30 if rng.random() < 0.3 else 6), rng.randint(1, 30 if rng.random() < 0.3 else 6)
        k = rng.randint(1, 3)
        image = [[rng.randint(0, k) for _ in range(cols)] for _ in range(rows)]
        yield (image, rng.randrange(rows), rng.randrange(cols), rng.randint(0, 3))


def one_island(rng, rows, cols):
    grid = [[0] * cols for _ in range(rows)]
    size = rng.randint(1, max(1, int(rows * cols * rng.uniform(0.1, 0.6))))
    r, c = rng.randrange(rows), rng.randrange(cols)
    grid[r][c], cells = 1, [(r, c)]
    for _ in range(size * 40):
        if len(cells) >= size:
            break
        r, c = rng.choice(cells)
        dr, dc = rng.choice([(1, 0), (-1, 0), (0, 1), (0, -1)])
        nr, nc = r + dr, c + dc
        if 0 <= nr < rows and 0 <= nc < cols and not grid[nr][nc]:
            grid[nr][nc] = 1
            cells.append((nr, nc))
    # LeetCode guarantees no lakes: water not connected to the border becomes land.
    outside = [[False] * cols for _ in range(rows)]
    queue = deque((r, c) for r in range(rows) for c in range(cols)
                  if (r in (0, rows - 1) or c in (0, cols - 1)) and not grid[r][c])
    for r, c in queue:
        outside[r][c] = True
    while queue:
        r, c = queue.popleft()
        for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if 0 <= nr < rows and 0 <= nc < cols and not grid[nr][nc] and not outside[nr][nc]:
                outside[nr][nc] = True
                queue.append((nr, nc))
    return [[1 if grid[r][c] or not outside[r][c] else 0 for c in range(cols)] for r in range(rows)]


def perimeter_oracle(grid):
    rows, cols, total = len(grid), len(grid[0]), 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c]:
                for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                    if not (0 <= nr < rows and 0 <= nc < cols) or not grid[nr][nc]:
                        total += 1
    return total


def _sorted_distinct(rng, n, lo, hi):
    return sorted(rng.sample(range(lo, hi + 1), n))


SPECS = [
    P(slug="valid-anagram", title="Valid Anagram", number=242,
      topics=["hash-table", "string", "sorting"],
      method="isAnagram", params=[("s", "string"), ("t", "string")], ret="bool",
      description="""
You are given two strings s and t. Decide whether t can be produced by rearranging the letters of s, using every letter of s exactly as many times as it appears.

Return true if t is such a rearrangement (an anagram) of s, and false otherwise.

Constraints:
- 1 <= s.length, t.length <= 5 * 10^4
- s and t contain only lowercase English letters.""",
      hints=["Two strings of different lengths can never be anagrams, so check that first.",
             "Anagrams have exactly the same multiset of letters. How could you compare multisets cheaply?",
             "Keep a count of 26 letters: add one for each letter of s, subtract one for each letter of t, and check every count ends at zero."],
      templates=templates("isAnagram(self, s: str, t: str) -> bool", "bool isAnagram(string s, string t)",
                          "bool isAnagram(char* s, char* t)", "boolean isAnagram(String s, String t)"),
      oracle=lambda s, t: sorted(s) == sorted(t), cases=anagram_cases),

    P(slug="reverse-linked-list", title="Reverse Linked List", number=206,
      topics=["linked-list", "recursion"],
      method="reverseList", params=[("head", "ListNode")], ret="ListNode",
      description="""
You are given the head of a singly linked list. Reverse the direction of every link so the last node becomes the first, and return the head of the reversed list.

Constraints:
- The number of nodes in the list is in the range [0, 5000].
- -5000 <= Node.val <= 5000""",
      hints=["Walk the list once, keeping track of the node you came from.",
             "Before you redirect a node's next pointer, save where it used to point or you will lose the rest of the list.",
             "Three pointers are enough: previous, current and next. When current runs off the end, previous is the new head."],
      templates=templates("reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]",
                          "ListNode* reverseList(ListNode* head)", "struct ListNode* reverseList(struct ListNode* head)",
                          "ListNode reverseList(ListNode head)", header="list"),
      oracle=lambda head: head[::-1],
      cases=lambda rng: _list_cases(rng, [([1, 2, 3, 4, 5],), ([1, 2],), ([],), ([7],)], 500, -5000, 5000)),

    P(slug="maximum-depth-of-binary-tree", title="Maximum Depth of Binary Tree", number=104,
      topics=["tree", "depth-first-search", "breadth-first-search", "binary-tree"],
      method="maxDepth", params=[("root", "TreeNode")], ret="int",
      description="""
Given the root of a binary tree, return its maximum depth: the number of nodes on the longest path that starts at the root and ends at a leaf. An empty tree has depth 0.

Constraints:
- The number of nodes in the tree is in the range [0, 10^4].
- -100 <= Node.val <= 100""",
      hints=["The depth of a tree can be defined in terms of the depths of its two subtrees.",
             "An empty subtree contributes depth 0; a node adds one level on top of its deeper child.",
             "Alternatively, count levels with a breadth-first traversal that processes one whole level per iteration."],
      templates=templates("maxDepth(self, root: Optional[TreeNode]) -> int", "int maxDepth(TreeNode* root)",
                          "int maxDepth(struct TreeNode* root)", "int maxDepth(TreeNode root)", header="tree"),
      oracle=lambda root: _height(tree_from_level(root)),
      cases=lambda rng: _tree_cases(rng, [([3, 9, 20, None, None, 15, 7],), ([1, None, 2],), ([],), ([0],)], 300, -100, 100)),

    P(slug="same-tree", title="Same Tree", number=100,
      topics=["tree", "depth-first-search", "breadth-first-search", "binary-tree"],
      method="isSameTree", params=[("p", "TreeNode"), ("q", "TreeNode")], ret="bool",
      description="""
You are given the roots of two binary trees, p and q. The trees are considered the same when they have exactly the same shape and every pair of corresponding nodes holds the same value.

Return true if p and q are the same tree, and false otherwise.

Constraints:
- The number of nodes in both trees is in the range [0, 100].
- -10^4 <= Node.val <= 10^4""",
      hints=["Compare the two roots first: both missing, exactly one missing, or both present.",
             "If both roots exist and hold equal values, the trees are the same only if both pairs of subtrees are the same.",
             "A recursive check on (p.left, q.left) and (p.right, q.right) covers every node exactly once."],
      templates=templates("isSameTree(self, p: Optional[TreeNode], q: Optional[TreeNode]) -> bool",
                          "bool isSameTree(TreeNode* p, TreeNode* q)", "bool isSameTree(struct TreeNode* p, struct TreeNode* q)",
                          "boolean isSameTree(TreeNode p, TreeNode q)", header="tree"),
      oracle=lambda p, q: tree_to_level(tree_from_level(p)) == tree_to_level(tree_from_level(q)),
      cases=lambda rng: same_tree_cases(rng)),

    P(slug="symmetric-tree", title="Symmetric Tree", number=101,
      topics=["tree", "depth-first-search", "breadth-first-search", "binary-tree"],
      method="isSymmetric", params=[("root", "TreeNode")], ret="bool",
      description="""
Given the root of a binary tree, decide whether the tree is a mirror image of itself around its centre line, in both shape and values.

Constraints:
- The number of nodes in the tree is in the range [1, 1000].
- -100 <= Node.val <= 100""",
      hints=["A tree is symmetric when its left subtree is a mirror image of its right subtree.",
             "Two subtrees mirror each other when their roots match, the outer children mirror each other, and the inner children mirror each other.",
             "Write a helper that takes two nodes at once, or use a queue that holds nodes in mirrored pairs."],
      templates=templates("isSymmetric(self, root: Optional[TreeNode]) -> bool", "bool isSymmetric(TreeNode* root)",
                          "bool isSymmetric(struct TreeNode* root)", "boolean isSymmetric(TreeNode root)", header="tree"),
      oracle=lambda root: tree_to_level(tree_from_level(root)) == tree_to_level(mirror(tree_from_level(root))),
      cases=lambda rng: symmetric_cases(rng)),

    P(slug="binary-search", title="Binary Search", number=704,
      topics=["array", "binary-search"],
      method="search", params=[("nums", "int[]"), ("target", "int")], ret="int",
      description="""
You are given an array nums of distinct integers sorted in increasing order, and an integer target. Return the index of target in nums, or -1 if it is not present.

Your algorithm must run in O(log n) time.

Constraints:
- 1 <= nums.length <= 10^4
- -10^4 < nums[i], target < 10^4
- All values in nums are distinct.
- nums is sorted in ascending order.""",
      hints=["Because the array is sorted, one comparison against the middle element rules out half of the remaining range.",
             "Keep two bounds, lo and hi, describing where target could still be.",
             "Compute the middle index as lo + (hi - lo) / 2 and stop when the range becomes empty."],
      templates=templates("search(self, nums: List[int], target: int) -> int", "int search(vector<int>& nums, int target)",
                          "int search(int* nums, int numsSize, int target)", "int search(int[] nums, int target)"),
      oracle=lambda nums, target: nums.index(target) if target in nums else -1,
      cases=lambda rng: search_cases(rng)),

    P(slug="ransom-note", title="Ransom Note", number=383,
      topics=["hash-table", "string", "counting"],
      method="canConstruct", params=[("ransomNote", "string"), ("magazine", "string")], ret="bool",
      description="""
You are given two strings, ransomNote and magazine. Each letter in magazine can be cut out and used at most once.

Return true if ransomNote can be assembled entirely from letters of magazine, and false otherwise.

Constraints:
- 1 <= ransomNote.length, magazine.length <= 10^5
- ransomNote and magazine consist of lowercase English letters.""",
      hints=["Only the number of each letter matters, not the order.",
             "Count how many of each letter the magazine offers.",
             "Walk the note and spend one count per letter; if any count would drop below zero, the note cannot be built."],
      templates=templates("canConstruct(self, ransomNote: str, magazine: str) -> bool",
                          "bool canConstruct(string ransomNote, string magazine)",
                          "bool canConstruct(char* ransomNote, char* magazine)",
                          "boolean canConstruct(String ransomNote, String magazine)"),
      oracle=lambda note, mag: not (Counter(note) - Counter(mag)),
      cases=lambda rng: ransom_cases(rng)),

    P(slug="majority-element", title="Majority Element", number=169,
      topics=["array", "hash-table", "divide-and-conquer", "sorting", "counting"],
      method="majorityElement", params=[("nums", "int[]")], ret="int",
      description="""
You are given an array nums of length n. Return the majority element: the value that appears more than n / 2 times. A majority element is guaranteed to exist.

Follow-up: can you solve it in linear time using O(1) extra space?

Constraints:
- n == nums.length
- 1 <= n <= 5 * 10^4
- -10^9 <= nums[i] <= 10^9""",
      hints=["A hash map of counts works in linear time, but uses linear extra space.",
             "If you sort the array, which index is guaranteed to hold the majority value?",
             "For O(1) space, pair off different values and cancel them: keep a candidate and a counter, incrementing on a match and decrementing otherwise."],
      templates=templates("majorityElement(self, nums: List[int]) -> int", "int majorityElement(vector<int>& nums)",
                          "int majorityElement(int* nums, int numsSize)", "int majorityElement(int[] nums)"),
      oracle=lambda nums: Counter(nums).most_common(1)[0][0],
      cases=lambda rng: majority_cases(rng)),

    P(slug="single-number", title="Single Number", number=136,
      topics=["array", "bit-manipulation"],
      method="singleNumber", params=[("nums", "int[]")], ret="int",
      description="""
You are given a non-empty array of integers in which every value appears exactly twice, except for one value that appears once. Return that value.

Your solution must run in linear time and use only constant extra space.

Constraints:
- 1 <= nums.length <= 3 * 10^4
- -3 * 10^4 <= nums[i] <= 3 * 10^4
- Every element appears twice except for exactly one element, which appears once.""",
      hints=["A set or map solves it in linear time, but not in constant space.",
             "Think about a binary operation where combining a value with itself cancels out.",
             "XOR has exactly that property, and it is commutative, so XOR-ing the whole array leaves only the single value."],
      templates=templates("singleNumber(self, nums: List[int]) -> int", "int singleNumber(vector<int>& nums)",
                          "int singleNumber(int* nums, int numsSize)", "int singleNumber(int[] nums)"),
      oracle=lambda nums: next(v for v, c in Counter(nums).items() if c == 1),
      cases=lambda rng: single_cases(rng)),

    P(slug="move-zeroes", title="Move Zeroes", number=283,
      topics=["array", "two-pointers"],
      method="moveZeroes", params=[("nums", "int[]")], ret="void",
      description="""
You are given an integer array nums. Move every 0 to the end of the array while keeping the non-zero elements in their original relative order.

Modify nums in place; do not return anything and do not make a copy of the array.

Constraints:
- 1 <= nums.length <= 10^4
- -2^31 <= nums[i] <= 2^31 - 1""",
      hints=["Picture writing the non-zero values into a new array in order, then padding with zeros. Can you do that without the new array?",
             "Keep a write index for where the next non-zero value belongs.",
             "After every non-zero value has been written forward, fill the positions from the write index to the end with zeros (or swap as you go)."],
      templates=templates("moveZeroes(self, nums: List[int]) -> None", "void moveZeroes(vector<int>& nums)",
                          "void moveZeroes(int* nums, int numsSize)", "void moveZeroes(int[] nums)"),
      oracle=lambda nums: [v for v in nums if v != 0] + [0] * nums.count(0),
      cases=lambda rng: move_zero_cases(rng)),

    P(slug="palindrome-number", title="Palindrome Number", number=9,
      topics=["math"],
      method="isPalindrome", params=[("x", "int")], ret="bool",
      description="""
Given an integer x, return true if its decimal representation reads the same forwards and backwards, and false otherwise. Negative numbers are never palindromes, because of the leading minus sign.

Follow-up: can you solve it without converting the integer to a string?

Constraints:
- -2^31 <= x <= 2^31 - 1""",
      hints=["Negative numbers, and positive numbers ending in 0, can be rejected immediately.",
             "Reversing the whole number can overflow. What if you only reverse half of it?",
             "Pop digits off the end of x onto a reversed number until the reversed number is at least as large as what remains, then compare the two halves."],
      templates=templates("isPalindrome(self, x: int) -> bool", "bool isPalindrome(int x)",
                          "bool isPalindrome(int x)", "boolean isPalindrome(int x)"),
      oracle=lambda x: str(x) == str(x)[::-1],
      cases=lambda rng: palindrome_number_cases(rng)),

    P(slug="roman-to-integer", title="Roman to Integer", number=13,
      topics=["hash-table", "math", "string"],
      method="romanToInt", params=[("s", "string")], ret="int",
      description="""
Roman numerals use seven symbols: I = 1, V = 5, X = 10, L = 50, C = 100, D = 500 and M = 1000. Symbols are normally written from largest to smallest and their values added. Six combinations instead place a smaller symbol before a larger one to mean subtraction: IV = 4, IX = 9, XL = 40, XC = 90, CD = 400 and CM = 900.

Given a valid Roman numeral s, return the integer it represents.

Constraints:
- 1 <= s.length <= 15
- s contains only the characters 'I', 'V', 'X', 'L', 'C', 'D', 'M'.
- s is guaranteed to be a valid Roman numeral in the range [1, 3999].""",
      hints=["Map each of the seven symbols to its value.",
             "A symbol is subtracted exactly when the symbol after it has a larger value.",
             "Scan left to right: subtract the current value if the next one is bigger, otherwise add it."],
      templates=templates("romanToInt(self, s: str) -> int", "int romanToInt(string s)",
                          "int romanToInt(char* s)", "int romanToInt(String s)"),
      oracle=roman_oracle,
      cases=lambda rng: roman_cases(rng)),

    P(slug="longest-common-prefix", title="Longest Common Prefix", number=14,
      topics=["string", "trie"],
      method="longestCommonPrefix", params=[("strs", "string[]")], ret="string",
      description="""
Given an array of strings strs, return the longest string that is a prefix of every string in the array. If the strings share no common prefix, return the empty string "".

Constraints:
- 1 <= strs.length <= 200
- 0 <= strs[i].length <= 200
- strs[i] consists of only lowercase English letters.""",
      hints=["The answer can never be longer than the shortest string.",
             "Compare the strings column by column: position 0 in every string, then position 1, and so on.",
             "Stop at the first column where some string has ended or disagrees with the first string."],
      templates=templates("longestCommonPrefix(self, strs: List[str]) -> str", "string longestCommonPrefix(vector<string>& strs)",
                          "char* longestCommonPrefix(char** strs, int strsSize)", "String longestCommonPrefix(String[] strs)"),
      oracle=lambda strs: os.path.commonprefix(strs),
      cases=lambda rng: lcp_cases(rng)),

    P(slug="plus-one", title="Plus One", number=66,
      topics=["array", "math"],
      method="plusOne", params=[("digits", "int[]")], ret="int[]",
      description="""
A large non-negative integer is stored as an array digits, most significant digit first, with no leading zeros. Add one to the integer and return the resulting array of digits.

Constraints:
- 1 <= digits.length <= 100
- 0 <= digits[i] <= 9
- digits does not contain any leading 0's.""",
      hints=["Adding one only changes the trailing run of 9s and the digit just before it.",
             "Walk from the last digit: a digit below 9 is incremented and you are done; a 9 becomes 0 and the carry moves left.",
             "If the carry survives past the first digit, the result is one digit longer: a 1 followed by zeros."],
      templates=templates("plusOne(self, digits: List[int]) -> List[int]", "vector<int> plusOne(vector<int>& digits)",
                          "int* plusOne(int* digits, int digitsSize, int* returnSize)", "int[] plusOne(int[] digits)",
                          c_note=C_ARR_NOTE),
      oracle=lambda digits: [int(ch) for ch in str(int("".join(map(str, digits))) + 1)],
      cases=lambda rng: plus_one_cases(rng)),

    P(slug="sqrtx", title="Sqrt(x)", number=69,
      topics=["math", "binary-search"],
      method="mySqrt", params=[("x", "int")], ret="int",
      description="""
Given a non-negative integer x, return the square root of x rounded down to the nearest integer. The result must itself be a non-negative integer.

You may not use a built-in exponent or square-root function or operator.

Constraints:
- 0 <= x <= 2^31 - 1""",
      hints=["The answer is the largest integer r such that r * r <= x.",
             "That condition is monotonic in r, so you can binary search over r.",
             "Use 64-bit arithmetic for r * r, since the square of a candidate near 46341 overflows a 32-bit integer."],
      templates=templates("mySqrt(self, x: int) -> int", "int mySqrt(int x)", "int mySqrt(int x)", "int mySqrt(int x)"),
      oracle=lambda x: math.isqrt(x),
      cases=lambda rng: sqrt_cases(rng)),

    P(slug="merge-sorted-array", title="Merge Sorted Array", number=88,
      topics=["array", "two-pointers", "sorting"],
      method="merge", params=[("nums1", "int[]"), ("m", "int"), ("nums2", "int[]"), ("n", "int")], ret="void",
      description="""
You are given two integer arrays nums1 and nums2, each sorted in non-decreasing order, and two integers m and n giving the number of real elements in nums1 and nums2.

nums1 has length m + n: its first m positions hold its elements and its last n positions are placeholders set to 0. Merge nums2 into nums1 so that nums1 holds all m + n elements in non-decreasing order. Modify nums1 in place and return nothing.

Constraints:
- nums1.length == m + n
- nums2.length == n
- 0 <= m, n <= 200
- 1 <= m + n <= 200
- -10^9 <= nums1[i], nums2[j] <= 10^9""",
      hints=["Merging from the front would overwrite values in nums1 that you still need.",
             "The free space is at the back of nums1, so fill the result from the back.",
             "Compare the largest remaining element of each array and place the larger one at the current write position; once nums2 is exhausted, the rest of nums1 is already in place."],
      templates=templates("merge(self, nums1: List[int], m: int, nums2: List[int], n: int) -> None",
                          "void merge(vector<int>& nums1, int m, vector<int>& nums2, int n)",
                          "void merge(int* nums1, int nums1Size, int m, int* nums2, int nums2Size, int n)",
                          "void merge(int[] nums1, int m, int[] nums2, int n)"),
      oracle=lambda nums1, m, nums2, n: sorted(nums1[:m] + nums2),
      cases=lambda rng: merge_cases(rng)),

    P(slug="pascals-triangle", title="Pascal's Triangle", number=118, case_count=30,
      topics=["array", "dynamic-programming"],
      method="generate", params=[("numRows", "int")], ret="int[][]",
      description="""
Given an integer numRows, return the first numRows rows of Pascal's triangle.

Each row starts and ends with 1, and every other entry is the sum of the two entries directly above it in the previous row.

Constraints:
- 1 <= numRows <= 30""",
      hints=["Row i has i + 1 entries.",
             "The first and last entries of every row are 1.",
             "Each interior entry j of row i equals row[i-1][j-1] + row[i-1][j], so build the rows in order."],
      templates=templates("generate(self, numRows: int) -> List[List[int]]", "vector<vector<int>> generate(int numRows)",
                          "int** generate(int numRows, int* returnSize, int** returnColumnSizes)",
                          "List<List<Integer>> generate(int numRows)", c_note=C_ARR2_NOTE),
      oracle=lambda numRows: [[math.comb(r, c) for c in range(r + 1)] for r in range(numRows)],
      cases=lambda rng: iter([(n,) for n in [5, 1, 2, 30] + list(range(3, 30))])),

    P(slug="diameter-of-binary-tree", title="Diameter of Binary Tree", number=543,
      topics=["tree", "depth-first-search", "binary-tree"],
      method="diameterOfBinaryTree", params=[("root", "TreeNode")], ret="int",
      description="""
Given the root of a binary tree, return the length of its diameter: the number of edges on the longest path between any two nodes. The path does not have to pass through the root.

Constraints:
- The number of nodes in the tree is in the range [1, 10^4].
- -100 <= Node.val <= 100""",
      hints=["Every path has a single highest node where it turns around.",
             "The longest path that turns at a node is the height of its left subtree plus the height of its right subtree.",
             "Compute heights bottom-up in one traversal and record the best left + right sum seen at any node."],
      templates=templates("diameterOfBinaryTree(self, root: Optional[TreeNode]) -> int", "int diameterOfBinaryTree(TreeNode* root)",
                          "int diameterOfBinaryTree(struct TreeNode* root)", "int diameterOfBinaryTree(TreeNode root)",
                          header="tree"),
      oracle=lambda root: max(_height(n.left) + _height(n.right) for n in _all_nodes(tree_from_level(root))),
      cases=lambda rng: _tree_cases(rng, [([1, 2, 3, 4, 5],), ([1, 2],), ([1],)], 300, -100, 100, allow_empty=False)),

    P(slug="balanced-binary-tree", title="Balanced Binary Tree", number=110,
      topics=["tree", "depth-first-search", "binary-tree"],
      method="isBalanced", params=[("root", "TreeNode")], ret="bool",
      description="""
Given a binary tree, decide whether it is height-balanced. A tree is height-balanced when, at every node, the heights of the left and right subtrees differ by at most one.

Constraints:
- The number of nodes in the tree is in the range [0, 5000].
- -10^4 <= Node.val <= 10^4""",
      hints=["Checking the height difference at the root alone is not enough; every node must satisfy it.",
             "Recomputing heights separately at each node is O(n^2) on a skewed tree.",
             "Return the height from a bottom-up traversal, and use a sentinel such as -1 to report that a subtree is already unbalanced."],
      templates=templates("isBalanced(self, root: Optional[TreeNode]) -> bool", "bool isBalanced(TreeNode* root)",
                          "bool isBalanced(struct TreeNode* root)", "boolean isBalanced(TreeNode root)", header="tree"),
      oracle=lambda root: all(abs(_height(n.left) - _height(n.right)) <= 1 for n in _all_nodes(tree_from_level(root))),
      cases=lambda rng: balanced_cases(rng)),

    P(slug="middle-of-the-linked-list", title="Middle of the Linked List", number=876,
      topics=["linked-list", "two-pointers"],
      method="middleNode", params=[("head", "ListNode")], ret="ListNode",
      description="""
Given the head of a singly linked list, return the middle node. When the list has an even number of nodes there are two middle nodes; return the second one.

Constraints:
- The number of nodes in the list is in the range [1, 100].
- 1 <= Node.val <= 100""",
      hints=["Counting the nodes first and then walking half way works in two passes.",
             "Can you find the middle in a single pass?",
             "Move one pointer one step and another two steps at a time; when the fast pointer reaches the end, the slow one is at the middle."],
      templates=templates("middleNode(self, head: Optional[ListNode]) -> Optional[ListNode]", "ListNode* middleNode(ListNode* head)",
                          "struct ListNode* middleNode(struct ListNode* head)", "ListNode middleNode(ListNode head)", header="list"),
      oracle=lambda head: head[len(head) // 2:],
      cases=lambda rng: _list_cases(rng, [([1, 2, 3, 4, 5],), ([1, 2, 3, 4, 5, 6],), ([1],), ([1, 2],)], 100, 1, 100, min_n=1)),

    P(slug="palindrome-linked-list", title="Palindrome Linked List", number=234,
      topics=["linked-list", "two-pointers", "stack", "recursion"],
      method="isPalindrome", params=[("head", "ListNode")], ret="bool",
      description="""
Given the head of a singly linked list, return true if the sequence of values reads the same forwards and backwards, and false otherwise.

Follow-up: can you do it in O(n) time and O(1) extra space?

Constraints:
- The number of nodes in the list is in the range [1, 10^5].
- 0 <= Node.val <= 9""",
      hints=["Copying the values into an array makes the comparison easy, at the cost of O(n) space.",
             "For O(1) space, find the middle of the list with a slow and a fast pointer.",
             "Reverse the second half in place, then walk both halves together comparing values."],
      templates=templates("isPalindrome(self, head: Optional[ListNode]) -> bool", "bool isPalindrome(ListNode* head)",
                          "bool isPalindrome(struct ListNode* head)", "boolean isPalindrome(ListNode head)", header="list"),
      oracle=lambda head: head == head[::-1],
      cases=lambda rng: palindrome_list_cases(rng)),

    P(slug="intersection-of-two-arrays", title="Intersection of Two Arrays", number=349, unorderedOutput=True,
      topics=["array", "hash-table", "two-pointers", "binary-search", "sorting"],
      method="intersection", params=[("nums1", "int[]"), ("nums2", "int[]")], ret="int[]",
      description="""
Given two integer arrays nums1 and nums2, return an array of their intersection: every value that appears in both arrays. Each value must appear only once in the result, and the result may be in any order.

Constraints:
- 1 <= nums1.length, nums2.length <= 1000
- 0 <= nums1[i], nums2[i] <= 1000""",
      hints=["Duplicates inside either array do not matter; only which distinct values are present.",
             "Put the values of one array into a set.",
             "Walk the other array and keep each value that is in the set, removing it from the set so it is not added twice."],
      templates=templates("intersection(self, nums1: List[int], nums2: List[int]) -> List[int]",
                          "vector<int> intersection(vector<int>& nums1, vector<int>& nums2)",
                          "int* intersection(int* nums1, int nums1Size, int* nums2, int nums2Size, int* returnSize)",
                          "int[] intersection(int[] nums1, int[] nums2)", c_note=C_ARR_NOTE),
      oracle=lambda a, b: sorted(set(a) & set(b)),
      cases=lambda rng: intersection_cases(rng)),

    P(slug="happy-number", title="Happy Number", number=202,
      topics=["hash-table", "math", "two-pointers"],
      method="isHappy", params=[("n", "int")], ret="bool",
      description="""
Start with a positive integer n and repeatedly replace it with the sum of the squares of its digits. If this process eventually reaches 1, n is a happy number. Otherwise the process loops forever through a cycle that never contains 1.

Return true if n is a happy number, and false if it is not.

Constraints:
- 1 <= n <= 2^31 - 1""",
      hints=["Try a few numbers by hand. The sequence either reaches 1 or starts repeating.",
             "Detecting a repeat is enough: remember every number you have seen in a set.",
             "To avoid the set, run a slow and a fast sequence (Floyd's cycle detection) and stop when they meet or the fast one reaches 1."],
      templates=templates("isHappy(self, n: int) -> bool", "bool isHappy(int n)", "bool isHappy(int n)", "boolean isHappy(int n)"),
      oracle=lambda n: happy_oracle(n),
      cases=lambda rng: happy_cases(rng)),

    P(slug="is-subsequence", title="Is Subsequence", number=392,
      topics=["two-pointers", "string", "dynamic-programming"],
      method="isSubsequence", params=[("s", "string"), ("t", "string")], ret="bool",
      description="""
Given two strings s and t, return true if s is a subsequence of t: that is, s can be obtained from t by deleting zero or more characters without changing the order of the remaining ones. Otherwise return false.

Constraints:
- 0 <= s.length <= 100
- 0 <= t.length <= 10^4
- s and t consist only of lowercase English letters.""",
      hints=["Matching characters of s as early as possible in t is never worse than matching them later.",
             "Keep one index into s and one into t.",
             "Advance through t, and advance the index into s whenever the characters match; s is a subsequence if that index reaches the end."],
      templates=templates("isSubsequence(self, s: str, t: str) -> bool", "bool isSubsequence(string s, string t)",
                          "bool isSubsequence(char* s, char* t)", "boolean isSubsequence(String s, String t)"),
      oracle=lambda s, t: (lambda it: all(ch in it for ch in s))(iter(t)),
      cases=lambda rng: subsequence_cases(rng)),

    P(slug="counting-bits", title="Counting Bits", number=338,
      topics=["dynamic-programming", "bit-manipulation"],
      method="countBits", params=[("n", "int")], ret="int[]",
      description="""
Given an integer n, return an array ans of length n + 1 where ans[i] is the number of 1 bits in the binary representation of i, for every i from 0 to n.

Follow-up: can you do it in O(n) time in a single pass, without a built-in popcount?

Constraints:
- 0 <= n <= 10^5""",
      hints=["Counting the bits of every number independently costs O(n log n).",
             "Shifting i right by one drops its lowest bit; you have already computed the answer for that smaller number.",
             "ans[i] = ans[i >> 1] + (i & 1)."],
      templates=templates("countBits(self, n: int) -> List[int]", "vector<int> countBits(int n)",
                          "int* countBits(int n, int* returnSize)", "int[] countBits(int n)", c_note=C_ARR_NOTE),
      oracle=lambda n: [bin(i).count("1") for i in range(n + 1)],
      cases=lambda rng: int_cases(rng, [2, 5, 0, 1, 1000], 0, 1000)),

    P(slug="fizz-buzz", title="Fizz Buzz", number=412,
      topics=["math", "string", "simulation"],
      method="fizzBuzz", params=[("n", "int")], ret="string[]",
      description="""
Given an integer n, return a string array answer indexed from 1 to n where:
- answer[i] is "FizzBuzz" if i is divisible by both 3 and 5,
- answer[i] is "Fizz" if i is divisible by 3 only,
- answer[i] is "Buzz" if i is divisible by 5 only,
- otherwise answer[i] is i written as a decimal string.

Constraints:
- 1 <= n <= 10^4""",
      hints=["Loop i from 1 to n and decide each entry independently.",
             "Check divisibility by 15 (both 3 and 5) before checking 3 or 5 alone.",
             "Alternatively, build the string by appending \"Fizz\" and \"Buzz\" separately, and fall back to the number when nothing was appended."],
      templates=templates("fizzBuzz(self, n: int) -> List[str]", "vector<string> fizzBuzz(int n)",
                          "char** fizzBuzz(int n, int* returnSize)", "List<String> fizzBuzz(int n)", c_note=C_ARR_NOTE),
      oracle=lambda n: ["Fizz" * (i % 3 == 0) + "Buzz" * (i % 5 == 0) or str(i) for i in range(1, n + 1)],
      cases=lambda rng: int_cases(rng, [3, 5, 15, 1, 2], 1, 500)),

    P(slug="search-insert-position", title="Search Insert Position", number=35,
      topics=["array", "binary-search"],
      method="searchInsert", params=[("nums", "int[]"), ("target", "int")], ret="int",
      description="""
You are given a sorted array nums of distinct integers and a target value. Return the index of target if it is present. If it is not, return the index at which it would have to be inserted to keep the array sorted.

Your algorithm must run in O(log n) time.

Constraints:
- 1 <= nums.length <= 10^4
- -10^4 <= nums[i] <= 10^4
- nums contains distinct values sorted in ascending order.
- -10^4 <= target <= 10^4""",
      hints=["Both cases ask for the same thing: the first index whose value is at least target.",
             "Binary search over the range [0, n], where n means \"after every element\".",
             "If nums[mid] < target the answer is to the right of mid; otherwise mid itself may be the answer."],
      templates=templates("searchInsert(self, nums: List[int], target: int) -> int", "int searchInsert(vector<int>& nums, int target)",
                          "int searchInsert(int* nums, int numsSize, int target)", "int searchInsert(int[] nums, int target)"),
      oracle=lambda nums, target: bisect.bisect_left(nums, target),
      cases=lambda rng: search_insert_cases(rng)),

    P(slug="add-binary", title="Add Binary", number=67,
      topics=["math", "string", "bit-manipulation", "simulation"],
      method="addBinary", params=[("a", "string"), ("b", "string")], ret="string",
      description="""
Given two binary strings a and b, return their sum, also written as a binary string.

Constraints:
- 1 <= a.length, b.length <= 10^4
- a and b consist only of '0' or '1' characters.
- Neither string has leading zeros, except for the number zero itself.""",
      hints=["The strings can be far longer than any built-in integer type, so add them digit by digit.",
             "Start from the rightmost digit of each string and carry into the next position, exactly as in decimal addition.",
             "Continue while either string has digits left or the carry is non-zero, then reverse the collected digits."],
      templates=templates("addBinary(self, a: str, b: str) -> str", "string addBinary(string a, string b)",
                          "char* addBinary(char* a, char* b)", "String addBinary(String a, String b)"),
      oracle=lambda a, b: bin(int(a, 2) + int(b, 2))[2:],
      cases=lambda rng: add_binary_cases(rng)),

    P(slug="binary-tree-inorder-traversal", title="Binary Tree Inorder Traversal", number=94,
      topics=["stack", "tree", "depth-first-search", "binary-tree"],
      method="inorderTraversal", params=[("root", "TreeNode")], ret="int[]",
      description="""
Given the root of a binary tree, return the values of its nodes in inorder: for every node, all of its left subtree first, then the node itself, then all of its right subtree.

Follow-up: the recursive solution is straightforward. Can you do it iteratively?

Constraints:
- The number of nodes in the tree is in the range [0, 100].
- -100 <= Node.val <= 100""",
      hints=["Recursion follows the definition directly: left, node, right.",
             "To iterate, simulate the call stack with an explicit stack of nodes.",
             "Push nodes while walking left; when you cannot go further, pop a node, record it, and move to its right child."],
      templates=templates("inorderTraversal(self, root: Optional[TreeNode]) -> List[int]", "vector<int> inorderTraversal(TreeNode* root)",
                          "int* inorderTraversal(struct TreeNode* root, int* returnSize)", "List<Integer> inorderTraversal(TreeNode root)",
                          header="tree", c_note=C_ARR_NOTE),
      oracle=lambda root: inorder_oracle(tree_from_level(root)),
      cases=lambda rng: _tree_cases(rng, [([1, None, 2, 3],), ([],), ([1],)], 100, -100, 100)),

    P(slug="flood-fill", title="Flood Fill", number=733,
      topics=["array", "depth-first-search", "breadth-first-search", "matrix"],
      method="floodFill", params=[("image", "int[][]"), ("sr", "int"), ("sc", "int"), ("color", "int")], ret="int[][]",
      description="""
An image is given as an m x n grid of integers, where image[i][j] is the colour of a pixel. You are also given a starting pixel (sr, sc) and a new colour.

Perform a flood fill: recolour the starting pixel, then every pixel connected to it through up, down, left or right neighbours that had the same original colour as the starting pixel. Return the modified image.

Constraints:
- m == image.length
- n == image[i].length
- 1 <= m, n <= 50
- 0 <= image[i][j], color < 2^16
- 0 <= sr < m
- 0 <= sc < n""",
      hints=["Record the starting pixel's original colour before changing anything.",
             "If the new colour equals the original colour there is nothing to do, and filling anyway would loop forever.",
             "Visit connected pixels with DFS or BFS, recolouring each one as you reach it so it is never visited twice."],
      templates=templates("floodFill(self, image: List[List[int]], sr: int, sc: int, color: int) -> List[List[int]]",
                          "vector<vector<int>> floodFill(vector<vector<int>>& image, int sr, int sc, int color)",
                          "int** floodFill(int** image, int imageSize, int* imageColSize, int sr, int sc, int color, int* returnSize, int** returnColumnSizes)",
                          "int[][] floodFill(int[][] image, int sr, int sc, int color)", c_note=C_ARR2_NOTE),
      oracle=flood_oracle, cases=flood_cases),

    P(slug="island-perimeter", title="Island Perimeter", number=463,
      topics=["array", "depth-first-search", "breadth-first-search", "matrix"],
      method="islandPerimeter", params=[("grid", "int[][]")], ret="int",
      description="""
You are given a row x col grid where grid[i][j] = 1 is land and grid[i][j] = 0 is water. Cells are joined only horizontally and vertically. The grid contains exactly one island (one or more connected land cells), is surrounded by water, and the island has no lakes inside it.

Each cell is a square with side length 1. Return the perimeter of the island.

Constraints:
- row == grid.length
- col == grid[i].length
- 1 <= row, col <= 100
- grid[i][j] is 0 or 1.
- There is exactly one island in grid.""",
      hints=["Each land cell contributes 4 edges before accounting for its neighbours.",
             "Every pair of adjacent land cells hides two edges, one from each cell.",
             "Count land cells and adjacent land pairs (checking only right and down avoids double counting): perimeter = 4 * land - 2 * pairs."],
      templates=templates("islandPerimeter(self, grid: List[List[int]]) -> int", "int islandPerimeter(vector<vector<int>>& grid)",
                          "int islandPerimeter(int** grid, int gridSize, int* gridColSize)", "int islandPerimeter(int[][] grid)"),
      oracle=perimeter_oracle,
      cases=lambda rng: island_cases(rng)),
]


# ── case generators referenced above ─────────────────────────────────────

def same_tree_cases(rng):
    yield from [([1, 2, 3], [1, 2, 3]), ([1, 2], [1, None, 2]), ([1, 2, 1], [1, 1, 2]), ([], []), ([], [0]), ([5], [5])]
    while True:
        p = tree_to_level(random_tree(rng, rng.randint(1, 100 if rng.random() < 0.4 else 7), -10000, 10000))
        roll = rng.random()
        if roll < 0.45:
            q = list(p)
        elif roll < 0.75:
            q = _mutate_level(rng, p, -10000, 10000)
        elif roll < 0.9:
            q = tree_to_level(mirror(tree_from_level(p)))
        else:
            q = tree_to_level(random_tree(rng, len([v for v in p if v is not None]), -3, 3))
        yield (p, q)


def symmetric_cases(rng):
    yield from [([1, 2, 2, 3, 4, 4, 3],), ([1, 2, 2, None, 3, None, 3],), ([1],), ([1, 2, 3],), ([1, 2, 2, 2, None, 2],),
                ([1, 1, None, 1],), ([2, 2, 2, None, 2, 2, None],)]
    while True:
        roll = rng.random()
        if roll < 0.25:
            # Uniform values, lopsided shape: an inorder palindrome that is not a mirror.
            # Without these, a values-only check passed 49/50 cases.
            v = rng.randint(-100, 100)
            left = random_tree(rng, rng.randint(1, 30), v, v)
            right = random_tree(rng, rng.randint(0, 30), v, v)
            yield (tree_to_level(Node(v, left, right)),)
            continue
        half = random_tree(rng, rng.randint(0, 120 if rng.random() < 0.4 else 5), -3 if rng.random() < 0.5 else -100, 3)
        root = Node(rng.randint(-100, 100), half, mirror(half))
        level = tree_to_level(root)
        if roll < 0.55:
            level = _mutate_level(rng, level, -100, 100)
        yield (level,)


def search_cases(rng):
    base = [-1, 0, 3, 5, 9, 12]
    yield from [(base, 9), (base, 2), ([5], 5), ([5], -5), (base, -1), (base, 12), (base, 13)]
    while True:
        nums = _sorted_distinct(rng, rng.randint(1, 300 if rng.random() < 0.5 else 10), -9999, 9999)
        target = rng.choice(nums) if rng.random() < 0.6 else rng.randint(-9999, 9999)
        yield (nums, target)


def ransom_cases(rng):
    yield from [("a", "b"), ("aa", "ab"), ("aa", "aab"), ("abc", "cba"), ("z", "z")]
    while True:
        alpha = LOWER[: rng.randint(1, 26)]
        mag = rand_str(rng, rng.randint(1, 1500 if rng.random() < 0.3 else 20), alpha)
        k = rng.randint(1, len(mag))
        note = "".join(rng.sample(mag, k))
        if rng.random() < 0.45:
            note += rng.choice(LOWER)
        yield (note, mag)


def majority_cases(rng):
    yield from [([3, 2, 3],), ([2, 2, 1, 1, 1, 2, 2],), ([1],), ([-1, -1, 2],)]
    while True:
        n = rng.randint(1, 300 if rng.random() < 0.5 else 9)
        lo, hi = (-10**9, 10**9) if rng.random() < 0.5 else (-5, 5)
        maj = rng.randint(lo, hi)
        k = rng.randint(n // 2 + 1, n)
        others = [rng.randint(lo, hi) for _ in range(n - k)]
        others = [v if v != maj else maj + 1 for v in others]
        nums = [maj] * k + others
        rng.shuffle(nums)
        yield (nums,)


def single_cases(rng):
    yield from [([2, 2, 1],), ([4, 1, 2, 1, 2],), ([1],), ([-30000, 7, 7],)]
    while True:
        m = rng.randint(0, 150 if rng.random() < 0.5 else 4)
        values = rng.sample(range(-30000, 30001), m + 1)
        nums = values[1:] * 2 + [values[0]]
        rng.shuffle(nums)
        yield (nums,)


def move_zero_cases(rng):
    yield from [([0, 1, 0, 3, 12],), ([0],), ([1],), ([0, 0, 1],), ([1, 2],), ([-2147483648, 0, 2147483647],)]
    while True:
        n = rng.randint(1, 300 if rng.random() < 0.4 else 10)
        p = rng.random()
        yield ([0 if rng.random() < p else rng.randint(-1000, 1000) for _ in range(n)],)


def palindrome_number_cases(rng):
    yield from [(121,), (-121,), (10,), (0,), (2147483647,), (-2147483648,), (1221,), (1000021,), (11,), (2147447412,)]
    while True:
        if rng.random() < 0.5:
            half = str(rng.randint(1, 99999))
            text = half + (half[::-1] if rng.random() < 0.5 else half[-2::-1])
            value = int(text)
            if value > 2**31 - 1:
                continue
            roll = rng.random()
            if roll < 0.25 and value > 10:
                value += rng.choice([1, 10])
            elif roll < 0.5:
                value = -value  # negative palindromes: the minus sign alone must make them false
            yield (value,)
        else:
            yield (rng.randint(-2**31, 2**31 - 1) if rng.random() < 0.5 else rng.randint(0, 100000),)


def roman_cases(rng):
    yield from [("III",), ("LVIII",), ("MCMXCIV",), ("IV",), ("IX",), ("MMMCMXCIX",), ("XL",), ("CD",)]
    while True:
        yield (to_roman(rng.randint(1, 3999)),)


def lcp_cases(rng):
    yield from [(["flower", "flow", "flight"],), (["dog", "racecar", "car"],), ([""],), (["a"],), (["ab", "a"],), (["", "b"],)]
    while True:
        prefix = rand_str(rng, rng.randint(0, 10), "abc")
        k = rng.randint(1, 30 if rng.random() < 0.5 else 4)
        strs = [prefix + rand_str(rng, rng.randint(0, 20), "abc") for _ in range(k)]
        if rng.random() < 0.2:
            strs[rng.randrange(k)] = prefix[: rng.randint(0, len(prefix))]
        yield (strs,)


def plus_one_cases(rng):
    yield from [([1, 2, 3],), ([4, 3, 2, 1],), ([9],), ([9, 9, 9],), ([0],), ([8, 9, 9],)]
    while True:
        n = rng.randint(1, 100 if rng.random() < 0.4 else 8)
        digits = [rng.randint(1, 9)] + [rng.randint(0, 9) for _ in range(n - 1)]
        if rng.random() < 0.4:
            nines = rng.randint(1, n)
            digits = digits[: n - nines] + [9] * nines
        yield (digits,)


def sqrt_cases(rng):
    yield from [(4,), (8,), (0,), (1,), (2,), (3,), (2147483647,), (2147395600,), (2147395599,), (46340 * 46340 + 1,)]
    while True:
        roll = rng.random()
        if roll < 0.4:
            r = rng.randint(1, 46340)
            yield (max(0, r * r + rng.choice([-1, 0, 1])),)
        elif roll < 0.7:
            yield (rng.randint(0, 2**31 - 1),)
        else:
            yield (rng.randint(0, 1000),)


def merge_cases(rng):
    yield from [([1, 2, 3, 0, 0, 0], 3, [2, 5, 6], 3), ([1], 1, [], 0), ([0], 0, [1], 1), ([4, 5, 6, 0, 0, 0], 3, [1, 2, 3], 3)]
    while True:
        m = rng.randint(0, 200 if rng.random() < 0.4 else 6)
        n = rng.randint(0 if m else 1, 200 if rng.random() < 0.4 else 6)
        if m + n > 200:
            continue
        lo, hi = (-10**9, 10**9) if rng.random() < 0.3 else (-20, 20)
        a = sorted(rng.randint(lo, hi) for _ in range(m))
        b = sorted(rng.randint(lo, hi) for _ in range(n))
        yield (a + [0] * n, m, b, n)


def balanced_cases(rng):
    yield from [([3, 9, 20, None, None, 15, 7],), ([1, 2, 2, 3, 3, None, None, 4, 4],), ([],), ([1],), ([1, 2, None, 3],)]
    while True:
        n = rng.randint(1, 300 if rng.random() < 0.4 else 12)
        if rng.random() < 0.5:
            def build(k):
                if k == 0:
                    return None
                left = min(k - 1, max(0, (k - 1) // 2 + rng.choice([-1, 0, 0, 1])))
                return Node(rng.randint(-10000, 10000), build(left), build(k - 1 - left))
            yield (tree_to_level(build(n)),)
        else:
            yield (tree_to_level(random_tree(rng, n, -10000, 10000)),)


def palindrome_list_cases(rng):
    yield from [([1, 2, 2, 1],), ([1, 2],), ([1],), ([1, 2, 1],), ([1, 1, 2, 1],)]
    while True:
        half = [rng.randint(0, 9) for _ in range(rng.randint(1, 250 if rng.random() < 0.4 else 5))]
        vals = half + (half[::-1] if rng.random() < 0.5 else half[-2::-1])
        if rng.random() < 0.4 and vals:
            i = rng.randrange(len(vals))
            vals[i] = (vals[i] + rng.randint(1, 9)) % 10
        yield (vals,)


def intersection_cases(rng):
    yield from [([1, 2, 2, 1], [2, 2]), ([4, 9, 5], [9, 4, 9, 8, 4]), ([1], [2]), ([0], [0])]
    while True:
        hi = 1000 if rng.random() < 0.4 else 20
        a = [rng.randint(0, hi) for _ in range(rng.randint(1, 300 if rng.random() < 0.4 else 10))]
        b = [rng.randint(0, hi) for _ in range(rng.randint(1, 300 if rng.random() < 0.4 else 10))]
        yield (a, b)


def happy_oracle(n):
    seen = set()
    while n != 1 and n not in seen:
        seen.add(n)
        n = sum(int(d) ** 2 for d in str(n))
    return n == 1


def happy_cases(rng):
    yield from [(19,), (2,), (1,), (7,), (2147483647,), (4,), (100,)]
    while True:
        yield (rng.randint(1, 2**31 - 1) if rng.random() < 0.5 else rng.randint(1, 1000),)


def subsequence_cases(rng):
    yield from [("abc", "ahbgdc"), ("axc", "ahbgdc"), ("", "ahbgdc"), ("", ""), ("a", ""), ("aaa", "aa")]
    while True:
        alpha = LOWER[: rng.randint(1, 6)]
        t = rand_str(rng, rng.randint(0, 2000 if rng.random() < 0.3 else 15), alpha)
        if t and rng.random() < 0.5:
            idx = sorted(rng.sample(range(len(t)), rng.randint(0, min(100, len(t)))))
            s = "".join(t[i] for i in idx)
        else:
            s = rand_str(rng, rng.randint(0, 8), alpha)
        yield (s, t)


def int_cases(rng, fixed, lo, hi):
    yield from [(v,) for v in fixed]
    while True:
        yield (rng.randint(lo, hi),)


def search_insert_cases(rng):
    base = [1, 3, 5, 6]
    yield from [(base, 5), (base, 2), (base, 7), (base, 0), ([1], 0), ([1], 2), ([1], 1)]
    while True:
        nums = _sorted_distinct(rng, rng.randint(1, 300 if rng.random() < 0.5 else 8), -10000, 10000)
        target = rng.choice(nums) if rng.random() < 0.4 else rng.randint(max(-10000, nums[0] - 5), min(10000, nums[-1] + 5))
        yield (nums, target)


def add_binary_cases(rng):
    yield from [("11", "1"), ("1010", "1011"), ("0", "0"), ("1", "0"), ("1111", "1")]
    while True:
        def binary():
            n = rng.randint(1, 1000 if rng.random() < 0.3 else 12)
            return "1" + rand_str(rng, n - 1, "01") if rng.random() < 0.95 else "0"
        yield (binary(), binary())


def inorder_oracle(root):
    if root is None:
        return []
    return inorder_oracle(root.left) + [root.val] + inorder_oracle(root.right)


def island_cases(rng):
    yield from [([[0, 1, 0, 0], [1, 1, 1, 0], [0, 1, 0, 0], [1, 1, 0, 0]],), ([[1]],), ([[1, 0]],), ([[1, 1], [1, 1]],)]
    while True:
        rows = rng.randint(1, 30 if rng.random() < 0.4 else 6)
        cols = rng.randint(1, 30 if rng.random() < 0.4 else 6)
        yield (one_island(rng, rows, cols),)


if __name__ == "__main__":
    write_all(SPECS)
