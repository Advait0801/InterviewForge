"""Phase 7 batch 2b: 23 medium problems, including three design problems.

    python scripts/problemgen/batch2b_medium.py

Same rules as earlier batches: statements in our own words, LeetCode's
signatures, company tags from curation.py, and oracles that share no logic with the
reference solutions. Where no genuinely different algorithm is practical
(koko-eating-bananas), the oracle asserts a certificate of the answer instead.
"""
from __future__ import annotations

import itertools
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (  # noqa: E402
    C_ARR2_NOTE, C_ARR_NOTE, Node, design_templates, rand_str, random_tree, templates,
    tree_from_level, tree_to_level, write_all,
)

INT_MAX = 2**31 - 1
ALNUM = "abcdefghijklmnopqrstuvwxyz0123456789"


def P(**spec):
    spec.setdefault("difficulty", "medium")
    return spec


def _nodes(root):
    out, stack = [], [root] if root else []
    while stack:
        node = stack.pop()
        out.append(node)
        stack.extend(c for c in (node.right, node.left) if c)
    return out


def _preorder(node):
    return [] if node is None else [node.val] + _preorder(node.left) + _preorder(node.right)


def _inorder(node):
    return [] if node is None else _inorder(node.left) + [node.val] + _inorder(node.right)


def _trunc_div(a, b):
    q = abs(a) // abs(b)
    return q if (a < 0) == (b < 0) else -q


# ── oracles ──────────────────────────────────────────────────────────────

def daily_oracle(temps):
    out = []
    for i, t in enumerate(temps):
        out.append(next((j - i for j in range(i + 1, len(temps)) if temps[j] > t), 0))
    return out


def rpn_oracle(tokens):
    # Parse from the right: the last token is the root operator. The references
    # use a left-to-right stack instead.
    pos = len(tokens)

    def parse():
        nonlocal pos
        pos -= 1
        tok = tokens[pos]
        if tok in ("+", "-", "*", "/"):
            right = parse()
            left = parse()
            return {"+": left + right, "-": left - right, "*": left * right}.get(tok) if tok != "/" else _trunc_div(left, right)
        return int(tok)

    value = parse()
    assert pos == 0
    return value


def right_view_oracle(level):
    levels = []

    def walk(node, depth):
        if node is None:
            return
        if depth == len(levels):
            levels.append([])
        levels[depth].append(node.val)
        walk(node.left, depth + 1)
        walk(node.right, depth + 1)

    walk(tree_from_level(level), 0)
    return [row[-1] for row in levels]


def build_tree_oracle(preorder, inorder):
    def build(pre, ino):
        if not pre:
            return None
        root = Node(pre[0])
        k = ino.index(pre[0])
        root.left = build(pre[1:k + 1], ino[:k])
        root.right = build(pre[k + 1:], ino[k + 1:])
        return root
    return tree_to_level(build(preorder, inorder))


def good_nodes_oracle(level):
    root = tree_from_level(level)
    parent, order = {root: None}, [root]
    for node in order:
        for child in (node.left, node.right):
            if child:
                parent[child] = node
                order.append(child)
    count = 0
    for node in order:
        anc, good = parent[node], True
        while anc is not None:
            if anc.val > node.val:
                good = False
                break
            anc = parent[anc]
        count += good
    return count


def pacific_oracle(heights):
    m, n = len(heights), len(heights[0])
    out = []
    for r in range(m):
        for c in range(n):
            seen, stack, pac, atl = {(r, c)}, [(r, c)], False, False
            while stack:
                x, y = stack.pop()
                pac |= x == 0 or y == 0
                atl |= x == m - 1 or y == n - 1
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < m and 0 <= ny < n and (nx, ny) not in seen and heights[nx][ny] <= heights[x][y]:
                        seen.add((nx, ny))
                        stack.append((nx, ny))
            if pac and atl:
                out.append([r, c])
    return out


def provinces_oracle(graph):
    n = len(graph)
    reach = [[bool(graph[i][j]) or i == j for j in range(n)] for i in range(n)]
    for k in range(n):
        for i in range(n):
            if reach[i][k]:
                row_k = reach[k]
                reach[i] = [a or b for a, b in zip(reach[i], row_k)]
    return len({tuple(row) for row in reach})


def gas_valid_starts(gas, cost):
    n, valid = len(gas), []
    for s in range(n):
        tank = 0
        for step in range(n):
            i = (s + step) % n
            tank += gas[i] - cost[i]
            if tank < 0:
                break
        else:
            valid.append(s)
    return valid


def sudoku_oracle(board):
    cells = [(r, c, board[r][c]) for r in range(9) for c in range(9) if board[r][c] != "."]
    for i, (r1, c1, v1) in enumerate(cells):
        for r2, c2, v2 in cells[i + 1:]:
            if v1 == v2 and (r1 == r2 or c1 == c2 or (r1 // 3, c1 // 3) == (r2 // 3, c2 // 3)):
                return False
    return True


def subarray_sum_oracle(nums, k):
    count = 0
    for i in range(len(nums)):
        total = 0
        for j in range(i, len(nums)):
            total += nums[j]
            count += total == k
    return count


def max_product_oracle(nums):
    best = nums[0]
    for i in range(len(nums)):
        p = 1
        for j in range(i, len(nums)):
            p *= nums[j]
            best = max(best, p)
    return best


def products_fit(nums):
    for i in range(len(nums)):
        p = 1
        for j in range(i, len(nums)):
            p *= nums[j]
            if p == 0:
                break
            if abs(p) > INT_MAX:
                return False
    return True


def palindromic_oracle(s):
    return sum(1 for i in range(len(s)) for j in range(i + 1, len(s) + 1) if s[i:j] == s[i:j][::-1])


def change_oracle(amount, coins):
    n = len(coins)
    ways = [[0] * (amount + 1) for _ in range(n + 1)]
    ways[n][0] = 1
    for i in range(n - 1, -1, -1):
        for a in range(amount + 1):
            ways[i][a] = ways[i + 1][a] + (ways[i][a - coins[i]] if a >= coins[i] else 0)
    return ways[0][amount]


def change_fits(amount, coins):
    # The references keep a 1-D table; every intermediate entry must fit in an int.
    dp = [1] + [0] * amount
    for c in coins:
        for a in range(c, amount + 1):
            dp[a] += dp[a - c]
        if max(dp) > INT_MAX:
            return False
    return True


def target_sum_oracle(nums, target):
    half = len(nums) // 2

    def sums(part):
        return Counter(sum(s * v for s, v in zip(signs, part)) for signs in itertools.product((1, -1), repeat=len(part)))

    left, right = sums(nums[:half]), sums(nums[half:])
    return sum(k * right[target - s] for s, k in left.items())


def koko_oracle(piles, h):
    def hours(k):
        return sum(-(-p // k) for p in piles)
    lo, hi = 1, max(piles)
    while lo < hi:
        mid = (lo + hi) // 2
        if hours(mid) <= h:
            hi = mid
        else:
            lo = mid + 1
    # Certificate: lo is feasible and lo - 1 is not. Hours are monotone in k, so
    # this proves minimality independently of how lo was found.
    assert hours(lo) <= h and (lo == 1 or hours(lo - 1) > h)
    return lo


def min_stack_oracle(ops, args):
    stack, out = [], [None]
    for op, a in zip(ops[1:], args[1:]):
        if op == "push":
            stack.append(a[0])
            out.append(None)
        elif op == "pop":
            stack.pop()
            out.append(None)
        elif op == "top":
            out.append(stack[-1])
        else:
            out.append(min(stack))
    return out


def lru_oracle(ops, args):
    capacity, items, out = args[0][0], [], [None]  # items: [key, value], least recent first
    for op, a in zip(ops[1:], args[1:]):
        idx = next((i for i, kv in enumerate(items) if kv[0] == a[0]), None)
        if op == "get":
            if idx is None:
                out.append(-1)
            else:
                kv = items.pop(idx)
                items.append(kv)
                out.append(kv[1])
        else:
            if idx is not None:
                items.pop(idx)
            elif len(items) == capacity:
                items.pop(0)
            items.append([a[0], a[1]])
            out.append(None)
    return out


def time_map_oracle(ops, args):
    entries, out = [], [None]
    for op, a in zip(ops[1:], args[1:]):
        if op == "set":
            entries.append((a[0], a[2], a[1]))
            out.append(None)
        else:
            found = [(ts, v) for k, ts, v in entries if k == a[0] and ts <= a[1]]
            out.append(max(found)[1] if found else "")
    return out


# ── case generators ──────────────────────────────────────────────────────

def int_list_cases(rng, fixed, min_n, max_n, ranges):
    yield from fixed
    while True:
        lo, hi = rng.choice(ranges)
        n = rng.randint(min_n, max_n if rng.random() < 0.5 else min(max_n, 10))
        yield ([rng.randint(lo, hi) for _ in range(n)],)


def rpn_cases(rng):
    yield from [(["2", "1", "+", "3", "*"],), (["4", "13", "5", "/", "+"],),
                (["10", "6", "9", "3", "+", "-11", "*", "/", "*", "17", "+", "5", "+"],), (["18"],), (["-7", "2", "/"],)]
    while True:
        leaves = rng.randint(1, 100 if rng.random() < 0.3 else 8)

        def build(k):
            if k == 1:
                v = rng.randint(-200, 200)
                return [str(v)], v
            left_k = rng.randint(1, k - 1)
            lt, lv = build(left_k)
            rt, rv = build(k - left_k)
            op = rng.choice("++--*//")
            if op == "/" and rv == 0:
                op = "-"
            v = {"+": lv + rv, "-": lv - rv, "*": lv * rv}[op] if op != "/" else _trunc_div(lv, rv)
            if abs(v) > INT_MAX:
                raise OverflowError
            return lt + rt + [op], v

        try:
            yield (build(leaves)[0],)
        except OverflowError:
            continue


def tree_cases(rng, fixed, max_n, lo, hi, min_n=0):
    yield from fixed
    while True:
        n = rng.randint(min_n, max_n if rng.random() < 0.4 else min(max_n, 8))
        yield (tree_to_level(random_tree(rng, n, lo, hi)),)


def random_bst(rng, n, lo, hi):
    vals = sorted(rng.sample(range(lo, hi + 1), n))

    def build(i, j):
        if i > j:
            return None
        m = rng.randint(i, j)
        return Node(vals[m], build(i, m - 1), build(m + 1, j))
    return build(0, n - 1)


def kth_bst_cases(rng):
    yield from [([3, 1, 4, None, 2], 1), ([5, 3, 6, 2, 4, None, None, 1], 3), ([1], 1), ([2, 1, 3], 3)]
    while True:
        n = rng.randint(1, 300 if rng.random() < 0.4 else 10)
        yield (tree_to_level(random_bst(rng, n, 0, 10000)), rng.randint(1, n))


def build_tree_cases(rng):
    yield from [([3, 9, 20, 15, 7], [9, 3, 15, 20, 7]), ([-1], [-1]), ([1, 2], [2, 1]), ([1, 2], [1, 2])]
    while True:
        n = rng.randint(1, 300 if rng.random() < 0.4 else 10)
        root = random_tree(rng, n, 0, 0)
        for node, v in zip(_nodes(root), rng.sample(range(-3000, 3001), n)):
            node.val = v
        yield (_preorder(root), _inorder(root))


def good_nodes_cases(rng):
    yield from [([3, 1, 4, 3, None, 1, 5],), ([3, 3, None, 4, 2],), ([1],), ([2, None, 2, None, 2],)]
    while True:
        n = rng.randint(1, 300 if rng.random() < 0.4 else 10)
        lo, hi = rng.choice([(-10000, 10000), (-3, 3)])
        yield (tree_to_level(random_tree(rng, n, lo, hi)),)


def pacific_cases(rng):
    yield from [([[1, 2, 2, 3, 5], [3, 2, 3, 4, 4], [2, 4, 5, 3, 1], [6, 7, 1, 4, 5], [5, 1, 1, 2, 4]],), ([[1]],),
                ([[1, 2], [4, 3]],), ([[3, 3, 3], [3, 1, 3], [3, 3, 3]],)]
    while True:
        if rng.random() < 0.3:
            m, n, hi = rng.randint(1, 15), rng.randint(1, 15), 100000
        else:
            m, n, hi = rng.randint(1, 30), rng.randint(1, 30), rng.choice([2, 5, 9])
        yield ([[rng.randint(0, hi) for _ in range(n)] for _ in range(m)],)


def provinces_cases(rng):
    yield from [([[1, 1, 0], [1, 1, 0], [0, 0, 1]],), ([[1, 0, 0], [0, 1, 0], [0, 0, 1]],), ([[1]],),
                ([[1, 0, 0, 1], [0, 1, 1, 0], [0, 1, 1, 1], [1, 0, 1, 1]],)]
    while True:
        n = rng.randint(1, 45 if rng.random() < 0.4 else 8)
        g = [[1 if i == j else 0 for j in range(n)] for i in range(n)]
        if rng.random() < 0.5:
            label = [rng.randrange(rng.randint(1, n)) for _ in range(n)]
            for i in range(n):
                for j in range(i + 1, n):
                    if label[i] == label[j] and rng.random() < 0.3:
                        g[i][j] = g[j][i] = 1
        else:
            density = rng.choice([0.02, 0.05, 0.15])
            for i in range(n):
                for j in range(i + 1, n):
                    if rng.random() < density:
                        g[i][j] = g[j][i] = 1
        yield (g,)


def gas_cases(rng):
    yield from [([1, 2, 3, 4, 5], [3, 4, 5, 1, 2]), ([2, 3, 4], [3, 4, 3]), ([5], [4]), ([4], [5]), ([0], [0])]
    while True:
        n = rng.randint(1, 300 if rng.random() < 0.4 else 8)
        hi = rng.choice([5, 100, 10000])
        gas = [rng.randint(0, hi) for _ in range(n)]
        cost = [rng.randint(0, hi) for _ in range(n)]
        if rng.random() < 0.6:
            # Balance the totals so a valid start usually exists.
            delta = sum(cost) - sum(gas)
            target = gas if delta > 0 else cost
            remaining = abs(delta)
            for i in rng.sample(range(n), n):
                add = min(remaining, 10000 - target[i])
                target[i] += add
                remaining -= add
            if remaining:
                continue
        if len(gas_valid_starts(gas, cost)) <= 1:
            yield (gas, cost)


def duplicate_cases(rng):
    yield from [([1, 3, 4, 2, 2],), ([3, 1, 3, 4, 2],), ([3, 3, 3, 3, 3],), ([1, 1],), ([2, 2, 2],)]
    while True:
        n = rng.randint(1, 300 if rng.random() < 0.5 else 10)
        d = rng.randint(1, n)
        nums = list(range(1, n + 1)) + [d]
        others = [i for i, v in enumerate(nums) if v != d]
        for i in rng.sample(others, rng.randint(0, len(others) // 2)):
            nums[i] = d
        rng.shuffle(nums)
        yield (nums,)


def consecutive_cases(rng):
    yield from [([100, 4, 200, 1, 3, 2],), ([0, 3, 7, 2, 5, 8, 4, 6, 0, 1],), ([],), ([1, 0, 1, 2],), ([-1000000000, 1000000000],)]
    while True:
        roll = rng.random()
        n = rng.randint(1, 300 if rng.random() < 0.5 else 10)
        if roll < 0.35:
            nums = [rng.randint(-20, 20) for _ in range(n)]
        elif roll < 0.6:
            nums = [rng.randint(-10**9, 10**9) for _ in range(n)]
        else:
            nums = []
            while len(nums) < n:
                start = rng.randint(-10**9, 10**9 - 400)
                nums.extend(range(start, start + rng.randint(1, 30)))
            nums = nums[:n]
            rng.shuffle(nums)
        yield (nums,)


SUDOKU_EXAMPLE = [["5", "3", ".", ".", "7", ".", ".", ".", "."], ["6", ".", ".", "1", "9", "5", ".", ".", "."],
                  [".", "9", "8", ".", ".", ".", ".", "6", "."], ["8", ".", ".", ".", "6", ".", ".", ".", "3"],
                  ["4", ".", ".", "8", ".", "3", ".", ".", "1"], ["7", ".", ".", ".", "2", ".", ".", ".", "6"],
                  [".", "6", ".", ".", ".", ".", "2", "8", "."], [".", ".", ".", "4", "1", "9", ".", ".", "5"],
                  [".", ".", ".", ".", "8", ".", ".", "7", "9"]]


def sudoku_cases(rng):
    bad = [list(row) for row in SUDOKU_EXAMPLE]
    bad[0][0] = "8"
    yield from [(SUDOKU_EXAMPLE,), (bad,), ([["."] * 9 for _ in range(9)],)]
    while True:
        digits = rng.sample("123456789", 9)
        grid = [[digits[(3 * (r % 3) + r // 3 + c) % 9] for c in range(9)] for r in range(9)]
        rows = [r for band in rng.sample(range(3), 3) for r in rng.sample(range(band * 3, band * 3 + 3), 3)]
        cols = [c for stack in rng.sample(range(3), 3) for c in rng.sample(range(stack * 3, stack * 3 + 3), 3)]
        grid = [[grid[r][c] for c in cols] for r in rows]
        keep = rng.uniform(0.15, 0.6)
        board = [[v if rng.random() < keep else "." for v in row] for row in grid]
        roll = rng.random()
        if roll < 0.25:
            r, c = rng.randrange(9), rng.randrange(9)
            board[r][c] = rng.choice("123456789")
        elif roll < 0.5:
            # A duplicate that only the 3x3 box check can see: same box, different row and column.
            r, c = rng.randrange(9), rng.randrange(9)
            r2 = (r // 3) * 3 + (r % 3 + rng.randint(1, 2)) % 3
            c2 = (c // 3) * 3 + (c % 3 + rng.randint(1, 2)) % 3
            v = grid[r][c]
            if v not in [board[r2][k] for k in range(9)] and v not in [board[k][c2] for k in range(9)]:
                board[r][c], board[r2][c2] = v, v
        yield (board,)


def subarray_cases(rng):
    yield from [([1, 1, 1], 2), ([1, 2, 3], 3), ([1], 0), ([-1, -1, 1], 0), ([0, 0, 0], 0)]
    while True:
        lo, hi = rng.choice([(-1000, 1000), (-3, 3), (0, 2)])
        nums = [rng.randint(lo, hi) for _ in range(rng.randint(1, 300 if rng.random() < 0.5 else 10))]
        if rng.random() < 0.5:
            i = rng.randrange(len(nums))
            k = sum(nums[i:rng.randint(i + 1, len(nums))])
        else:
            k = rng.randint(-50, 50) if rng.random() < 0.7 else rng.randint(-10**7, 10**7)
        yield (nums, k)


def max_product_cases(rng):
    yield from [([2, 3, -2, 4],), ([-2, 0, -1],), ([-2],), ([-2, 3, -4],), ([0, 2],), ([-1, -1],)]
    pool = [0] * 4 + [1, -1] * 5 + [2, -2] * 2 + [3, -3, 5, -7, 10, -10]
    while True:
        nums = [rng.choice(pool) for _ in range(rng.randint(1, 300 if rng.random() < 0.4 else 10))]
        if products_fit(nums):
            yield (nums,)


def palindromic_cases(rng):
    yield from [("abc",), ("aaa",), ("a",), ("abba",), ("racecar",)]
    while True:
        yield (rand_str(rng, rng.randint(1, 300 if rng.random() < 0.3 else 15), rng.choice(["a", "ab", "abc", "abcdefghij"])),)


def change_cases(rng):
    yield from [(5, [1, 2, 5]), (3, [2]), (10, [10]), (0, [7]), (500, [3, 5, 7, 8, 9, 10, 11])]
    while True:
        if rng.random() < 0.25:
            amount, coins = rng.randint(0, 5000), rng.sample(range(1, 5001), rng.randint(1, 10))
        else:
            amount = rng.randint(0, 500)
            coins = rng.sample(range(1, rng.choice([10, 50, 500]) + 1), rng.randint(1, 10))
        if change_fits(amount, coins):
            yield (amount, coins)


def target_sum_cases(rng):
    yield from [([1, 1, 1, 1, 1], 3), ([1], 1), ([0, 0, 0], 0), ([1000], -1000), ([2, 3], 0)]
    while True:
        n = rng.randint(1, 20)
        cap = rng.choice([3, 50, max(1, 1000 // n)])
        nums = [rng.randint(0, cap) for _ in range(n)]
        if sum(nums) > 1000:
            continue
        if rng.random() < 0.6:
            target = sum(v * rng.choice((1, -1)) for v in nums)
        else:
            target = rng.randint(-1000, 1000)
        yield (nums, target)


def rotate_cases(rng):
    yield from [([1, 2, 3, 4, 5, 6, 7], 3), ([-1, -100, 3, 99], 2), ([1], 0), ([1, 2], 3), ([1, 2, 3], 100000)]
    while True:
        lo, hi = rng.choice([(-2**31, 2**31 - 1), (-50, 50)])
        n = rng.randint(1, 250 if rng.random() < 0.5 else 10)
        yield ([rng.randint(lo, hi) for _ in range(n)], rng.randint(0, 100000) if rng.random() < 0.3 else rng.randint(0, 2 * n))


def koko_cases(rng):
    yield from [([3, 6, 7, 11], 8), ([30, 11, 23, 4, 20], 5), ([30, 11, 23, 4, 20], 6), ([1000000000], 2),
                ([805306368, 805306368, 805306368], 1000000000), ([1], 1)]
    while True:
        n = rng.randint(1, 100 if rng.random() < 0.5 else 8)
        hi = rng.choice([30, 1000, 10**9])
        piles = [rng.randint(1, hi) for _ in range(n)]
        h = rng.randint(n, n * rng.randint(1, 5)) if rng.random() < 0.7 else rng.randint(n, 10**9)
        yield (piles, h)


def min_stack_cases(rng):
    yield (["MinStack", "push", "push", "push", "getMin", "pop", "top", "getMin"], [[], [-2], [0], [-3], [], [], [], []])
    while True:
        lo, hi = rng.choice([(-5, 5), (-2**31, 2**31 - 1), (-100, 100)])
        ops, args, size = ["MinStack"], [[]], 0
        for _ in range(rng.randint(1, 300 if rng.random() < 0.4 else 15)):
            if size == 0 or rng.random() < 0.45:
                ops.append("push")
                args.append([rng.randint(lo, hi)])
                size += 1
            else:
                op = rng.choice(["pop", "top", "getMin", "getMin"])
                ops.append(op)
                args.append([])
                size -= op == "pop"
        yield (ops, args)


def lru_cases(rng):
    yield (["LRUCache", "put", "put", "get", "put", "get", "put", "get", "get", "get"],
           [[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]])
    while True:
        capacity = rng.randint(1, 3000) if rng.random() < 0.15 else rng.randint(1, 6)
        key_hi = rng.choice([min(10000, capacity * 2), 10, 10000])
        ops, args = ["LRUCache"], [[capacity]]
        for _ in range(rng.randint(1, 400 if rng.random() < 0.4 else 20)):
            key = rng.randint(0, key_hi)
            if rng.random() < 0.5:
                ops.append("get")
                args.append([key])
            else:
                ops.append("put")
                args.append([key, rng.randint(0, 100000)])
        yield (ops, args)


def time_map_cases(rng):
    yield (["TimeMap", "set", "get", "get", "set", "get", "get"],
           [[], ["foo", "bar", 1], ["foo", 1], ["foo", 3], ["foo", "bar2", 4], ["foo", 4], ["foo", 5]])
    while True:
        keys = [rand_str(rng, rng.randint(1, 10), ALNUM) for _ in range(rng.randint(1, 5))]
        ops, args, ts = ["TimeMap"], [[]], 0
        for _ in range(rng.randint(1, 200 if rng.random() < 0.4 else 15)):
            if ts == 0 or rng.random() < 0.45:
                ts += rng.randint(1, 1000)
                ops.append("set")
                args.append([rng.choice(keys), rand_str(rng, rng.randint(1, 12), ALNUM), ts])
            else:
                key = rng.choice(keys) if rng.random() < 0.85 else "missing"
                ops.append("get")
                args.append([key, rng.randint(1, ts + 50)])
        yield (ops, args)


# ── specs ────────────────────────────────────────────────────────────────

MIN_STACK_METHODS = [("push", [("val", "int")], "void"), ("pop", [], "void"), ("top", [], "int"), ("getMin", [], "int")]
LRU_METHODS = [("get", [("key", "int")], "int"), ("put", [("key", "int"), ("value", "int")], "void")]
TIME_MAP_METHODS = [("set", [("key", "string"), ("value", "string"), ("timestamp", "int")], "void"),
                    ("get", [("key", "string"), ("timestamp", "int")], "string")]

SPECS = [
    P(slug="daily-temperatures", title="Daily Temperatures", number=739,
      topics=["array", "stack", "monotonic-stack"],
      method="dailyTemperatures", params=[("temperatures", "int[]")], ret="int[]",
      description="""
You are given an array temperatures of daily temperatures. Return an array answer where answer[i] is the number of days you would have to wait after day i to see a strictly warmer temperature. If no warmer day ever comes, answer[i] is 0.

Constraints:
- 1 <= temperatures.length <= 10^5
- 30 <= temperatures[i] <= 100""",
      hints=["Checking every later day for each day is O(n^2).",
             "Keep the indices of days that are still waiting for a warmer day on a stack.",
             "Their temperatures on the stack never increase from bottom to top, so a new warmer day resolves days from the top until it meets one that is at least as warm."],
      templates=templates("dailyTemperatures(self, temperatures: List[int]) -> List[int]",
                          "vector<int> dailyTemperatures(vector<int>& temperatures)",
                          "int* dailyTemperatures(int* temperatures, int temperaturesSize, int* returnSize)",
                          "int[] dailyTemperatures(int[] temperatures)", c_note=C_ARR_NOTE),
      oracle=daily_oracle,
      cases=lambda rng: int_list_cases(rng, [([73, 74, 75, 71, 69, 72, 76, 73],), ([30, 40, 50, 60],), ([30, 60, 90],), ([100],), ([50, 50, 50],)],
                                       1, 300, [(30, 100), (30, 35)])),

    P(slug="evaluate-reverse-polish-notation", title="Evaluate Reverse Polish Notation", number=150,
      topics=["array", "math", "stack"],
      method="evalRPN", params=[("tokens", "string[]")], ret="int",
      description="""
You are given an arithmetic expression as an array of tokens in Reverse Polish Notation, where every operator comes after its two operands. Evaluate the expression and return its value.

The operators are '+', '-', '*' and '/'. Every other token is an integer. Division between two integers truncates toward zero. There is never a division by zero, the expression is always valid, and every intermediate result fits in a 32-bit integer.

Constraints:
- 1 <= tokens.length <= 10^4
- tokens[i] is an operator or an integer in the range [-200, 200].""",
      hints=["Scan the tokens left to right, keeping the operands you have seen so far.",
             "When you meet an operator, its two operands are the two most recently seen values that have not been used yet.",
             "Pop the right operand first, then the left one, and push the result; watch the operand order for '-' and '/', and make sure division truncates toward zero."],
      templates=templates("evalRPN(self, tokens: List[str]) -> int", "int evalRPN(vector<string>& tokens)",
                          "int evalRPN(char** tokens, int tokensSize)", "int evalRPN(String[] tokens)"),
      oracle=rpn_oracle, cases=rpn_cases),

    P(slug="binary-tree-right-side-view", title="Binary Tree Right Side View", number=199,
      topics=["tree", "depth-first-search", "breadth-first-search", "binary-tree"],
      method="rightSideView", params=[("root", "TreeNode")], ret="int[]",
      description="""
Imagine standing to the right of a binary tree. Return the values of the nodes you can see, from top to bottom: for each depth, the rightmost node at that depth.

Constraints:
- The number of nodes in the tree is in the range [0, 100].
- -100 <= Node.val <= 100""",
      hints=["The visible node at each depth is simply the last node at that depth.",
             "A level-by-level breadth-first traversal makes the last node of each level easy to pick out.",
             "Alternatively, a depth-first traversal that visits the right child first records a node whenever it reaches a depth for the first time."],
      templates=templates("rightSideView(self, root: Optional[TreeNode]) -> List[int]", "vector<int> rightSideView(TreeNode* root)",
                          "int* rightSideView(struct TreeNode* root, int* returnSize)", "List<Integer> rightSideView(TreeNode root)",
                          header="tree", c_note=C_ARR_NOTE),
      oracle=right_view_oracle,
      cases=lambda rng: tree_cases(rng, [([1, 2, 3, None, 5, None, 4],), ([1, None, 3],), ([],), ([1, 2, 3, 4],)], 100, -100, 100)),

    P(slug="kth-smallest-element-in-a-bst", title="Kth Smallest Element in a BST", number=230,
      topics=["tree", "depth-first-search", "binary-search-tree", "binary-tree"],
      method="kthSmallest", params=[("root", "TreeNode"), ("k", "int")], ret="int",
      description="""
Given the root of a binary search tree and an integer k, return the k-th smallest value among all the nodes in the tree, counting from 1.

Follow-up: if the tree is modified often and you need the k-th smallest value frequently, how would you change your approach?

Constraints:
- The number of nodes in the tree is n.
- 1 <= k <= n <= 10^4
- 0 <= Node.val <= 10^4""",
      hints=["An inorder traversal of a binary search tree visits the values in increasing order.",
             "You do not need to collect every value: count nodes as the traversal visits them.",
             "An iterative inorder traversal with an explicit stack lets you stop as soon as the count reaches k."],
      templates=templates("kthSmallest(self, root: Optional[TreeNode], k: int) -> int", "int kthSmallest(TreeNode* root, int k)",
                          "int kthSmallest(struct TreeNode* root, int k)", "int kthSmallest(TreeNode root, int k)", header="tree"),
      oracle=lambda root, k: sorted(v for v in root if v is not None)[k - 1], cases=kth_bst_cases),

    P(slug="construct-binary-tree-from-preorder-and-inorder-traversal",
      title="Construct Binary Tree from Preorder and Inorder Traversal", number=105,
      topics=["array", "hash-table", "divide-and-conquer", "tree", "binary-tree"],
      method="buildTree", params=[("preorder", "int[]"), ("inorder", "int[]")], ret="TreeNode",
      description="""
You are given two integer arrays, preorder and inorder, which are the preorder and inorder traversals of the same binary tree. All values in the tree are unique. Rebuild the tree and return its root.

Constraints:
- 1 <= preorder.length <= 3000
- inorder.length == preorder.length
- -3000 <= preorder[i], inorder[i] <= 3000
- preorder and inorder consist of unique values.
- Each value of inorder also appears in preorder.
- preorder is guaranteed to be the preorder traversal of the tree.
- inorder is guaranteed to be the inorder traversal of the tree.""",
      hints=["The first value in preorder is always the root.",
             "Find that root in inorder: everything to its left is the left subtree and everything to its right is the right subtree, and the sizes tell you how to split preorder too.",
             "Store each value's inorder index in a hash map so the split is O(1), and consume preorder with a single moving index while recursing left then right."],
      templates=templates("buildTree(self, preorder: List[int], inorder: List[int]) -> Optional[TreeNode]",
                          "TreeNode* buildTree(vector<int>& preorder, vector<int>& inorder)",
                          "struct TreeNode* buildTree(int* preorder, int preorderSize, int* inorder, int inorderSize)",
                          "TreeNode buildTree(int[] preorder, int[] inorder)", header="tree"),
      oracle=build_tree_oracle, cases=build_tree_cases),

    P(slug="count-good-nodes-in-binary-tree", title="Count Good Nodes in Binary Tree", number=1448,
      topics=["tree", "depth-first-search", "breadth-first-search", "binary-tree"],
      method="goodNodes", params=[("root", "TreeNode")], ret="int",
      description="""
A node X in a binary tree is good if no node on the path from the root down to X has a value greater than X's value.

Given the root of a binary tree, return the number of good nodes. The root is always good.

Constraints:
- The number of nodes in the binary tree is in the range [1, 10^5].
- Each node's value is between [-10^4, 10^4].""",
      hints=["Whether a node is good depends only on the largest value above it on its path.",
             "Pass the maximum value seen so far down the recursion.",
             "A node is good when its value is >= that maximum; update the maximum before visiting its children."],
      templates=templates("goodNodes(self, root: TreeNode) -> int", "int goodNodes(TreeNode* root)",
                          "int goodNodes(struct TreeNode* root)", "int goodNodes(TreeNode root)", header="tree"),
      oracle=good_nodes_oracle, cases=good_nodes_cases),

    P(slug="pacific-atlantic-water-flow", title="Pacific Atlantic Water Flow", number=417, unorderedOutput=True,
      topics=["array", "depth-first-search", "breadth-first-search", "matrix"],
      method="pacificAtlantic", params=[("heights", "int[][]")], ret="int[][]",
      description="""
An m x n island is described by heights[r][c], the height of each cell. The Pacific Ocean touches the island's top and left edges; the Atlantic Ocean touches its bottom and right edges.

Rain water flows from a cell to a horizontally or vertically adjacent cell whose height is less than or equal to the current cell's height. Water in a cell next to an ocean can flow into that ocean.

Return the coordinates [r, c] of every cell from which water can reach both oceans, in any order.

Constraints:
- m == heights.length
- n == heights[r].length
- 1 <= m, n <= 200
- 0 <= heights[r][c] <= 10^5""",
      hints=["Simulating the flow from every cell separately repeats a lot of work.",
             "Reverse the direction: start from the cells touching an ocean and move to neighbours that are at least as high.",
             "Run that search once for the Pacific edges and once for the Atlantic edges; the answer is the cells reached by both."],
      templates=templates("pacificAtlantic(self, heights: List[List[int]]) -> List[List[int]]",
                          "vector<vector<int>> pacificAtlantic(vector<vector<int>>& heights)",
                          "int** pacificAtlantic(int** heights, int heightsSize, int* heightsColSize, int* returnSize, int** returnColumnSizes)",
                          "List<List<Integer>> pacificAtlantic(int[][] heights)", c_note=C_ARR2_NOTE),
      oracle=pacific_oracle, cases=pacific_cases),

    P(slug="number-of-provinces", title="Number of Provinces", number=547,
      topics=["depth-first-search", "breadth-first-search", "union-find", "graph"],
      method="findCircleNum", params=[("isConnected", "int[][]")], ret="int",
      description="""
There are n cities. You are given an n x n matrix isConnected where isConnected[i][j] = 1 if city i and city j are directly connected, and 0 otherwise. Connection is transitive: if a is connected to b and b to c, then a and c belong to the same group.

A province is a maximal group of cities that are connected directly or indirectly. Return the number of provinces.

Constraints:
- 1 <= n <= 200
- n == isConnected.length
- n == isConnected[i].length
- isConnected[i][j] is 1 or 0.
- isConnected[i][i] == 1
- isConnected[i][j] == isConnected[j][i]""",
      hints=["The matrix is an adjacency matrix, and a province is a connected component.",
             "Start a DFS or BFS from each city you have not visited yet; each start discovers one whole province.",
             "Union-find works too: union every connected pair and count the distinct roots."],
      templates=templates("findCircleNum(self, isConnected: List[List[int]]) -> int", "int findCircleNum(vector<vector<int>>& isConnected)",
                          "int findCircleNum(int** isConnected, int isConnectedSize, int* isConnectedColSize)",
                          "int findCircleNum(int[][] isConnected)"),
      oracle=provinces_oracle, cases=provinces_cases),

    P(slug="gas-station", title="Gas Station", number=134,
      topics=["array", "greedy"],
      method="canCompleteCircuit", params=[("gas", "int[]"), ("cost", "int[]")], ret="int",
      description="""
There are n gas stations on a circular route. Station i provides gas[i] units of fuel, and driving from station i to station i + 1 (wrapping around after the last station) uses cost[i] units.

Starting with an empty tank at one of the stations, you want to drive once around the whole circuit. Return the index of the starting station that makes this possible, or -1 if no station does. If a solution exists, it is guaranteed to be unique.

Constraints:
- n == gas.length == cost.length
- 1 <= n <= 10^5
- 0 <= gas[i], cost[i] <= 10^4
- The input is generated such that the answer is unique.""",
      hints=["If the total gas is less than the total cost, no start can work.",
             "If you start at s and run out of fuel before reaching station j, no station between s and j can be the start either.",
             "So scan once: reset the start to j + 1 and the tank to 0 whenever the tank goes negative, and check the total at the end."],
      templates=templates("canCompleteCircuit(self, gas: List[int], cost: List[int]) -> int",
                          "int canCompleteCircuit(vector<int>& gas, vector<int>& cost)",
                          "int canCompleteCircuit(int* gas, int gasSize, int* cost, int costSize)",
                          "int canCompleteCircuit(int[] gas, int[] cost)"),
      oracle=lambda gas, cost: (gas_valid_starts(gas, cost) or [-1])[0], cases=gas_cases),

    P(slug="sort-colors", title="Sort Colors", number=75,
      topics=["array", "two-pointers", "sorting"],
      method="sortColors", params=[("nums", "int[]")], ret="void",
      description="""
You are given an array nums whose values are 0, 1 and 2, standing for the colours red, white and blue. Sort the array in place so that all 0s come first, then all 1s, then all 2s.

Do not use the library's sort function.

Follow-up: can you do it in a single pass using only constant extra space?

Constraints:
- n == nums.length
- 1 <= n <= 300
- nums[i] is either 0, 1, or 2.""",
      hints=["Counting the 0s, 1s and 2s and rewriting the array takes two passes.",
             "For one pass, keep three regions: 0s at the front, 2s at the back, and an unexamined region in between.",
             "Walk a middle pointer: swap a 0 to the front boundary, swap a 2 to the back boundary (without advancing, since the swapped-in value is unexamined), and step over a 1."],
      templates=templates("sortColors(self, nums: List[int]) -> None", "void sortColors(vector<int>& nums)",
                          "void sortColors(int* nums, int numsSize)", "void sortColors(int[] nums)"),
      oracle=lambda nums: sorted(nums),
      cases=lambda rng: int_list_cases(rng, [([2, 0, 2, 1, 1, 0],), ([2, 0, 1],), ([0],), ([2, 2],), ([1, 0],)], 1, 300, [(0, 2)])),

    P(slug="find-the-duplicate-number", title="Find the Duplicate Number", number=287,
      topics=["array", "two-pointers", "binary-search", "bit-manipulation"],
      method="findDuplicate", params=[("nums", "int[]")], ret="int",
      description="""
You are given an array nums of n + 1 integers, each in the range [1, n]. Exactly one value is repeated, although it may appear more than twice. Return that value.

Solve it without modifying nums and using only constant extra space.

Constraints:
- 1 <= n <= 10^5
- nums.length == n + 1
- 1 <= nums[i] <= n
- Only one integer in nums appears more than once, possibly many times.""",
      hints=["Sorting or a set would be easy, but both break the constraints.",
             "Treat each index i as a node with an edge to nums[i]. Because some value is pointed to twice, following the edges from index 0 must enter a cycle.",
             "The duplicate is the entrance to that cycle, which Floyd's tortoise-and-hare algorithm finds in two phases."],
      templates=templates("findDuplicate(self, nums: List[int]) -> int", "int findDuplicate(vector<int>& nums)",
                          "int findDuplicate(int* nums, int numsSize)", "int findDuplicate(int[] nums)"),
      oracle=lambda nums: Counter(nums).most_common(1)[0][0], cases=duplicate_cases),

    P(slug="longest-consecutive-sequence", title="Longest Consecutive Sequence", number=128,
      topics=["array", "hash-table", "union-find"],
      method="longestConsecutive", params=[("nums", "int[]")], ret="int",
      description="""
Given an unsorted array of integers nums, return the length of the longest run of consecutive integers (such as 4, 5, 6, 7) whose values all appear in nums. The values do not have to be adjacent in the array.

Your algorithm must run in O(n) time.

Constraints:
- 0 <= nums.length <= 10^5
- -10^9 <= nums[i] <= 10^9""",
      hints=["Sorting makes runs easy to see, but costs O(n log n).",
             "Put every value into a hash set so membership checks are O(1).",
             "Only start counting from a value v when v - 1 is not in the set; then extend v + 1, v + 2, ... Each value is then counted at most once overall."],
      templates=templates("longestConsecutive(self, nums: List[int]) -> int", "int longestConsecutive(vector<int>& nums)",
                          "int longestConsecutive(int* nums, int numsSize)", "int longestConsecutive(int[] nums)"),
      oracle=lambda nums: consecutive_oracle(nums), cases=consecutive_cases),

    P(slug="valid-sudoku", title="Valid Sudoku", number=36,
      topics=["array", "hash-table", "matrix"],
      method="isValidSudoku", params=[("board", "char[][]")], ret="bool",
      description="""
Decide whether a partially filled 9 x 9 Sudoku board is valid. Filled cells hold a digit from '1' to '9' and empty cells hold '.'.

The board is valid when no digit repeats within any row, within any column, or within any of the nine 3 x 3 boxes. Only the filled cells matter: a valid board does not have to be solvable.

Constraints:
- board.length == 9
- board[i].length == 9
- board[i][j] is a digit 1-9 or '.'.""",
      hints=["Each filled cell belongs to exactly one row, one column and one box.",
             "The box index of cell (r, c) is (r / 3) * 3 + c / 3.",
             "Keep a seen-set (or a 9-bit mask) for every row, column and box, and fail as soon as a digit is already present in one of its three sets."],
      templates=templates("isValidSudoku(self, board: List[List[str]]) -> bool", "bool isValidSudoku(vector<vector<char>>& board)",
                          "bool isValidSudoku(char** board, int boardSize, int* boardColSize)", "boolean isValidSudoku(char[][] board)"),
      oracle=sudoku_oracle, cases=sudoku_cases),

    P(slug="subarray-sum-equals-k", title="Subarray Sum Equals K", number=560,
      topics=["array", "hash-table", "prefix-sum"],
      method="subarraySum", params=[("nums", "int[]"), ("k", "int")], ret="int",
      description="""
Given an integer array nums and an integer k, return the number of contiguous, non-empty subarrays whose elements add up to exactly k.

Constraints:
- 1 <= nums.length <= 2 * 10^4
- -1000 <= nums[i] <= 1000
- -10^7 <= k <= 10^7""",
      hints=["Negative numbers rule out a sliding window, because extending a window can decrease its sum.",
             "The sum of nums[i..j] equals prefix[j + 1] - prefix[i].",
             "Walk the array with a running prefix sum and a hash map counting how many earlier prefixes had each value; add the count of prefix - k at every step."],
      templates=templates("subarraySum(self, nums: List[int], k: int) -> int", "int subarraySum(vector<int>& nums, int k)",
                          "int subarraySum(int* nums, int numsSize, int k)", "int subarraySum(int[] nums, int k)"),
      oracle=subarray_sum_oracle, cases=subarray_cases),

    P(slug="maximum-product-subarray", title="Maximum Product Subarray", number=152,
      topics=["array", "dynamic-programming"],
      method="maxProduct", params=[("nums", "int[]")], ret="int",
      description="""
Given an integer array nums, find the contiguous, non-empty subarray with the largest product and return that product.

The tests guarantee that the product of every subarray fits in a 32-bit integer.

Constraints:
- 1 <= nums.length <= 2 * 10^4
- -10 <= nums[i] <= 10
- The product of any subarray of nums is guaranteed to fit in a 32-bit integer.""",
      hints=["A negative number turns the smallest product into the largest one.",
             "So for each position, track both the largest and the smallest product of a subarray ending there.",
             "At each element the new maximum and minimum come from the element alone, or the element times the previous maximum or minimum; a zero resets both."],
      templates=templates("maxProduct(self, nums: List[int]) -> int", "int maxProduct(vector<int>& nums)",
                          "int maxProduct(int* nums, int numsSize)", "int maxProduct(int[] nums)"),
      oracle=max_product_oracle, cases=max_product_cases),

    P(slug="palindromic-substrings", title="Palindromic Substrings", number=647,
      topics=["two-pointers", "string", "dynamic-programming"],
      method="countSubstrings", params=[("s", "string")], ret="int",
      description="""
Given a string s, return how many of its substrings are palindromes. A substring is a contiguous, non-empty sequence of characters. Substrings at different positions are counted separately even if they contain the same characters.

Constraints:
- 1 <= s.length <= 1000
- s consists of lowercase English letters.""",
      hints=["Checking every substring separately costs O(n^3).",
             "Every palindrome has a centre: either a single character or the gap between two characters.",
             "Expand outwards from each of the 2n - 1 centres while the characters on both sides match, counting one palindrome per successful step."],
      templates=templates("countSubstrings(self, s: str) -> int", "int countSubstrings(string s)",
                          "int countSubstrings(char* s)", "int countSubstrings(String s)"),
      oracle=palindromic_oracle, cases=palindromic_cases),

    P(slug="coin-change-ii", title="Coin Change II", number=518,
      topics=["array", "dynamic-programming"],
      method="change", params=[("amount", "int"), ("coins", "int[]")], ret="int",
      description="""
You are given an integer amount and an array coins of distinct coin denominations, with an unlimited supply of each coin. Return the number of different combinations of coins that add up to exactly amount. Combinations are unordered: 1 + 2 and 2 + 1 are the same combination. If amount cannot be made, return 0.

The tests guarantee that the answer fits in a signed 32-bit integer.

Constraints:
- 1 <= coins.length <= 300
- 1 <= coins[i] <= 5000
- All the values of coins are unique.
- 0 <= amount <= 5000""",
      hints=["Counting ordered sequences would count 1 + 2 and 2 + 1 twice.",
             "Fix the order in which coin types are considered: process one denomination at a time.",
             "With ways[0] = 1, for each coin c and each amount a from c upwards, add ways[a - c] into ways[a]. Looping coins outside amounts is what makes the count unordered."],
      templates=templates("change(self, amount: int, coins: List[int]) -> int", "int change(int amount, vector<int>& coins)",
                          "int change(int amount, int* coins, int coinsSize)", "int change(int amount, int[] coins)"),
      oracle=change_oracle, cases=change_cases),

    P(slug="target-sum", title="Target Sum", number=494,
      topics=["array", "dynamic-programming", "backtracking"],
      method="findTargetSumWays", params=[("nums", "int[]"), ("target", "int")], ret="int",
      description="""
You are given an integer array nums and an integer target. Build an expression by putting either '+' or '-' in front of every number and adding them all up.

Return the number of different sign assignments whose expression evaluates to target.

Constraints:
- 1 <= nums.length <= 20
- 0 <= nums[i] <= 1000
- 0 <= sum(nums[i]) <= 1000
- -1000 <= target <= 1000""",
      hints=["Trying all 2^n sign assignments is possible for n = 20, but slow.",
             "Track how many ways each running sum can be reached after the first i numbers; the sums stay within [-1000, 1000].",
             "Alternatively, if P is the set of numbers given '+', then sum(P) = (total + target) / 2, which turns the problem into counting subsets with a fixed sum."],
      templates=templates("findTargetSumWays(self, nums: List[int], target: int) -> int",
                          "int findTargetSumWays(vector<int>& nums, int target)",
                          "int findTargetSumWays(int* nums, int numsSize, int target)",
                          "int findTargetSumWays(int[] nums, int target)"),
      oracle=target_sum_oracle, cases=target_sum_cases),

    P(slug="rotate-array", title="Rotate Array", number=189,
      topics=["array", "math", "two-pointers"],
      method="rotate", params=[("nums", "int[]"), ("k", "int")], ret="void",
      description="""
Given an integer array nums, rotate it to the right by k steps, in place: every element moves k positions to the right, and elements that fall off the end wrap around to the front.

Follow-up: can you do it with O(1) extra space?

Constraints:
- 1 <= nums.length <= 10^5
- -2^31 <= nums[i] <= 2^31 - 1
- 0 <= k <= 10^5""",
      hints=["Rotating by k and by k % n gives the same result.",
             "Rotating right by k moves the last k elements to the front, keeping each block's internal order.",
             "Reverse the whole array, then reverse the first k elements, then reverse the remaining n - k elements."],
      templates=templates("rotate(self, nums: List[int], k: int) -> None", "void rotate(vector<int>& nums, int k)",
                          "void rotate(int* nums, int numsSize, int k)", "void rotate(int[] nums, int k)"),
      oracle=lambda nums, k: nums[len(nums) - k % len(nums):] + nums[:len(nums) - k % len(nums)], cases=rotate_cases),

    P(slug="koko-eating-bananas", title="Koko Eating Bananas", number=875,
      topics=["array", "binary-search"],
      method="minEatingSpeed", params=[("piles", "int[]"), ("h", "int")], ret="int",
      description="""
There are n piles of bananas, where piles[i] is the size of pile i. Koko has h hours before the guards return. She picks an eating speed k (bananas per hour). Each hour she chooses one pile and eats k bananas from it; if the pile has fewer than k bananas she finishes it and eats nothing more that hour.

Return the smallest integer speed k that lets her finish every pile within h hours.

Constraints:
- 1 <= piles.length <= 10^4
- piles.length <= h <= 10^9
- 1 <= piles[i] <= 10^9""",
      hints=["At speed k, a pile of size p takes ceil(p / k) hours.",
             "The total hours only go down as k goes up, so the feasible speeds form a range that you can binary search between 1 and max(piles).",
             "If you ever evaluate a very small speed (k = 1 gives sum(piles), up to 10^13), the total overflows 32 bits, so a 64-bit accumulator is the safe choice."],
      templates=templates("minEatingSpeed(self, piles: List[int], h: int) -> int", "int minEatingSpeed(vector<int>& piles, int h)",
                          "int minEatingSpeed(int* piles, int pilesSize, int h)", "int minEatingSpeed(int[] piles, int h)"),
      oracle=koko_oracle, cases=koko_cases),

    P(slug="min-stack", title="Min Stack", number=155, design=True, className="MinStack", ctor=[], methods=MIN_STACK_METHODS,
      topics=["stack", "design"],
      description="""
Design a stack that, in addition to the usual operations, can report its minimum element in constant time.

Implement the MinStack class:
- MinStack() creates an empty stack.
- void push(int val) pushes val onto the stack.
- void pop() removes the element on top of the stack.
- int top() returns the element on top of the stack.
- int getMin() returns the smallest element currently in the stack.

Every operation must run in O(1) time.

Constraints:
- -2^31 <= val <= 2^31 - 1
- pop, top and getMin are only called when the stack is non-empty.
- At most 3 * 10^4 calls are made in total.""",
      hints=["A single variable holding the minimum breaks as soon as that minimum is popped.",
             "The minimum only depends on what is below each element, and that never changes while the element is on the stack.",
             "Store, next to every pushed value, the minimum of the stack at the moment it was pushed."],
      templates=design_templates("MinStack", [], MIN_STACK_METHODS),
      oracle=min_stack_oracle, cases=min_stack_cases),

    P(slug="lru-cache", title="LRU Cache", number=146, design=True, className="LRUCache", ctor=[("capacity", "int")],
      methods=LRU_METHODS,
      topics=["hash-table", "linked-list", "design", "doubly-linked-list"],
      description="""
Design a cache with a fixed capacity that evicts the least recently used entry when it is full.

Implement the LRUCache class:
- LRUCache(int capacity) creates a cache that holds at most capacity entries.
- int get(int key) returns the value stored for key, or -1 if key is absent. A successful get counts as a use of key.
- void put(int key, int value) stores value for key, replacing any existing value, and counts as a use of key. If this adds a new key to a cache that is already full, first remove the key that was used least recently.

get and put must each run in O(1) average time.

Constraints:
- 1 <= capacity <= 3000
- 0 <= key <= 10^4
- 0 <= value <= 10^5
- At most 2 * 10^5 calls are made to get and put.""",
      hints=["A hash map gives O(1) lookup, but on its own it does not remember the order of use.",
             "A doubly linked list ordered by recency lets you move any node to the front, or remove the node at the back, in O(1).",
             "Combine them: the map points from each key to its list node. Sentinel head and tail nodes remove most edge cases."],
      templates=design_templates("LRUCache", [("capacity", "int")], LRU_METHODS),
      oracle=lru_oracle, cases=lru_cases),

    P(slug="time-based-key-value-store", title="Time Based Key-Value Store", number=981, design=True, className="TimeMap", ctor=[],
      methods=TIME_MAP_METHODS,
      topics=["hash-table", "string", "binary-search", "design"],
      description="""
Design a key-value store that keeps every value ever set for a key, each tagged with a timestamp, and can answer what a key's value was at a given time.

Implement the TimeMap class:
- TimeMap() creates an empty store.
- void set(String key, String value, int timestamp) records that key had value at time timestamp.
- String get(String key, int timestamp) returns the value from the most recent set for key whose timestamp is less than or equal to timestamp. If there is none, return "".

Constraints:
- 1 <= key.length, value.length <= 100
- key and value consist of lowercase English letters and digits.
- 1 <= timestamp <= 10^7
- The timestamps of all set calls are strictly increasing.
- At most 2 * 10^5 calls are made to set and get.""",
      hints=["Keep a separate list of (timestamp, value) pairs for each key.",
             "Because set timestamps are strictly increasing, each key's list is already sorted by timestamp.",
             "For get, binary search that list for the last timestamp that is <= the query."],
      templates=design_templates("TimeMap", [], TIME_MAP_METHODS),
      oracle=time_map_oracle, cases=time_map_cases),
]


def consecutive_oracle(nums):
    values = sorted(set(nums))
    best = run = 0
    for i, v in enumerate(values):
        run = run + 1 if i and v == values[i - 1] + 1 else 1
        best = max(best, run)
    return best


if __name__ == "__main__":
    write_all(SPECS)
