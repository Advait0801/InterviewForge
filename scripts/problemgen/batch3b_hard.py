"""Phase 7 batch 3b: the last 15 hard problems, including lfu-cache.

    python scripts/problemgen/batch3b_hard.py

Same rules as earlier batches. Oracles: O(n^2) "farthest reach with k stops"
DP (refuelling), threshold-by-threshold BFS (swim), every pair of paths
(cherry pickup), partition DP (split array), permutations (n-queens), prefix
brute force (shortest palindrome), cross products over every pair (max
points), remove-each-edge connectivity (bridges), fixed-point relaxation
(trapping rain water II), per-interval maxima (skyline), digit DP (digit one),
binary search with a certificate (dungeon), split-point brute force (stock III)
and a naive recency/frequency table (LFU).
"""
from __future__ import annotations

import itertools
import os
import sys
from functools import lru_cache

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import C_ARR2_NOTE, design_templates, rand_str, templates, write_all  # noqa: E402

INT_MAX = 2**31 - 1


def P(**spec):
    spec.setdefault("difficulty", "hard")
    return spec


# ── oracles ──────────────────────────────────────────────────────────────

def refuel_oracle(target, start_fuel, stations):
    reach = [start_fuel] + [0] * len(stations)  # reach[k]: farthest position using exactly k stops
    for i, (pos, fuel) in enumerate(stations):
        for k in range(i, -1, -1):
            if reach[k] >= pos:
                reach[k + 1] = max(reach[k + 1], reach[k] + fuel)
    return next((k for k, dist in enumerate(reach) if dist >= target), -1)


def swim_oracle(grid):
    n = len(grid)
    for t in sorted({v for row in grid for v in row}):
        if grid[0][0] > t:
            continue
        seen, stack = {(0, 0)}, [(0, 0)]
        while stack:
            r, c = stack.pop()
            for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                if 0 <= nr < n and 0 <= nc < n and (nr, nc) not in seen and grid[nr][nc] <= t:
                    seen.add((nr, nc))
                    stack.append((nr, nc))
        if (n - 1, n - 1) in seen:
            return t


def cherry_oracle(grid):
    # Enumerate every monotone path as a bitmask of cells; answer = best union of two paths.
    n = len(grid)
    ones = sum(1 << (r * n + c) for r in range(n) for c in range(n) if grid[r][c] == 1)
    paths = []

    def walk(r, c, mask):
        if grid[r][c] == -1:
            return
        mask |= 1 << (r * n + c)
        if r == n - 1 and c == n - 1:
            paths.append(mask & ones)
            return
        if r + 1 < n:
            walk(r + 1, c, mask)
        if c + 1 < n:
            walk(r, c + 1, mask)

    walk(0, 0, 0)
    return max((bin(a | b).count("1") for a in paths for b in paths), default=0)


def split_oracle(nums, k):
    n = len(nums)
    prefix = [0]
    for v in nums:
        prefix.append(prefix[-1] + v)
    inf = float("inf")
    best = [[inf] * (k + 1) for _ in range(n + 1)]
    best[0][0] = 0
    for i in range(1, n + 1):
        for parts in range(1, min(i, k) + 1):
            for j in range(parts - 1, i):
                best[i][parts] = min(best[i][parts], max(best[j][parts - 1], prefix[i] - prefix[j]))
    return best[n][k]


def queens_oracle(n):
    return sum(1 for perm in itertools.permutations(range(n))
               if len({r + perm[r] for r in range(n)}) == n and len({r - perm[r] for r in range(n)}) == n)


def shortest_pal_oracle(s):
    for end in range(len(s), -1, -1):
        if s[:end] == s[:end][::-1]:
            return s[end:][::-1] + s


def max_points_oracle(points):
    n = len(points)
    if n <= 2:
        return n
    best = 2
    for i in range(n):
        for j in range(i + 1, n):
            (x1, y1), (x2, y2) = points[i], points[j]
            best = max(best, sum(1 for x, y in points if (x2 - x1) * (y - y1) == (y2 - y1) * (x - x1)))
    return best


def bridges_oracle(n, connections):
    out = []
    for skip in range(len(connections)):
        adj = [[] for _ in range(n)]
        for idx, (a, b) in enumerate(connections):
            if idx != skip:
                adj[a].append(b)
                adj[b].append(a)
        seen, stack = {0}, [0]
        while stack:
            u = stack.pop()
            for v in adj[u]:
                if v not in seen:
                    seen.add(v)
                    stack.append(v)
        if len(seen) < n:
            out.append(sorted(connections[skip]))
    return out


def trap2_oracle(heights):
    m, n = len(heights), len(heights[0])
    inf = float("inf")
    level = [[heights[r][c] if r in (0, m - 1) or c in (0, n - 1) else inf for c in range(n)] for r in range(m)]
    changed = True
    while changed:
        changed = False
        for r in range(1, m - 1):
            for c in range(1, n - 1):
                v = max(heights[r][c], min(level[r - 1][c], level[r + 1][c], level[r][c - 1], level[r][c + 1]))
                if v < level[r][c]:
                    level[r][c] = v
                    changed = True
    return sum(level[r][c] - heights[r][c] for r in range(m) for c in range(n))


def skyline_oracle(buildings):
    xs = sorted({x for left, right, _ in buildings for x in (left, right)})
    out, prev = [], 0
    for x in xs:
        h = max((height for left, right, height in buildings if left <= x < right), default=0)
        if h != prev:
            out.append([x, h])
            prev = h
    return out


def digit_one_oracle(n):
    digits = str(n)

    @lru_cache(maxsize=None)
    def go(pos, tight):  # -> (how many numbers, how many 1 digits among them) for the remaining positions
        if pos == len(digits):
            return 1, 0
        limit = int(digits[pos]) if tight else 9
        numbers = ones = 0
        for d in range(limit + 1):
            count, sub = go(pos + 1, tight and d == limit)
            numbers += count
            ones += sub + (count if d == 1 else 0)
        return numbers, ones

    result = go(0, True)[1]
    if n <= 20000:
        assert result == sum(str(i).count("1") for i in range(n + 1))
    return result


_ONES = ("Zero One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve Thirteen Fourteen Fifteen "
         "Sixteen Seventeen Eighteen Nineteen").split()
_TENS = "_ _ Twenty Thirty Forty Fifty Sixty Seventy Eighty Ninety".split()


def _words_below_1000(n):
    parts = []
    if n >= 100:
        parts += [_ONES[n // 100], "Hundred"]
        n %= 100
    if n >= 20:
        parts.append(_TENS[n // 10])
        n %= 10
    if n:
        parts.append(_ONES[n])
    return parts


def english_oracle(num):
    if num == 0:
        return "Zero"
    words = []
    for scale, name in ((10**9, "Billion"), (10**6, "Million"), (10**3, "Thousand"), (1, "")):
        chunk = num // scale % 1000
        if chunk:
            words += _words_below_1000(chunk) + ([name] if name else [])
    return " ".join(words)


def dungeon_oracle(dungeon):
    m, n = len(dungeon), len(dungeon[0])

    def survives(hp):
        best = [[0] * n for _ in range(m)]  # best health after entering a cell; 0 = dead or unreachable
        for r in range(m):
            for c in range(n):
                before = hp if r == 0 and c == 0 else max(best[r - 1][c] if r else 0, best[r][c - 1] if c else 0)
                best[r][c] = max(0, before + dungeon[r][c]) if before > 0 else 0
        return best[m - 1][n - 1] > 0

    lo, hi = 1, 1 + 1000 * (m + n)
    while lo < hi:
        mid = (lo + hi) // 2
        if survives(mid):
            hi = mid
        else:
            lo = mid + 1
    # Certificate: lo survives and lo - 1 does not (survival is monotone in starting health).
    assert survives(lo) and (lo == 1 or not survives(lo - 1))
    return lo


def stock3_oracle(prices):
    def best_one(part):
        best, low = 0, float("inf")
        for p in part:
            low = min(low, p)
            best = max(best, p - low)
        return best
    return max(best_one(prices[:i]) + best_one(prices[i:]) for i in range(len(prices) + 1))


def lfu_oracle(ops, args):
    capacity, entries, tick, out = args[0][0], {}, 0, [None]  # key -> [value, frequency, last used]
    for op, a in zip(ops[1:], args[1:]):
        tick += 1
        key = a[0]
        if op == "get":
            if key in entries:
                entries[key][1] += 1
                entries[key][2] = tick
                out.append(entries[key][0])
            else:
                out.append(-1)
        else:
            if key in entries:
                entries[key][0] = a[1]
                entries[key][1] += 1
                entries[key][2] = tick
            else:
                if len(entries) == capacity:
                    victim = min(entries, key=lambda k: (entries[k][1], entries[k][2]))
                    del entries[victim]
                entries[key] = [a[1], 1, tick]
            out.append(None)
    return out


# ── case generators ──────────────────────────────────────────────────────

def refuel_cases(rng):
    yield from [(1, 1, []), (100, 1, [[10, 100]]), (100, 10, [[10, 60], [20, 30], [30, 30], [60, 40]]),
                (100, 50, [[25, 25], [50, 50]]), (1000000000, 1000000000, []), (1000, 1, [[1, 999], [500, 1]])]
    while True:
        big = rng.random() < 0.4
        target = rng.randint(2, 10**9 if big else 500)
        n = rng.randint(0, min(target - 1, 100 if rng.random() < 0.6 else 12))
        positions = sorted(rng.sample(range(1, target), n))
        scale = max(1, target // (n + 1))
        # Very uneven station sizes make the choice of which station to use matter; with even
        # sizes, taking the smallest passed station first passed 46/50.
        stations = [[p, rng.randint(1, min(10**9, scale * rng.choice([1, 1, 2, 5, 20])))] for p in positions]
        start = rng.randint(1, min(10**9, scale * rng.choice([1, 2])))
        yield (target, start, stations)


def swim_cases(rng):
    yield from [([[0, 2], [1, 3]],), ([[0, 1, 2, 3, 4], [24, 23, 22, 21, 5], [12, 13, 14, 15, 16], [11, 17, 18, 19, 20], [10, 9, 8, 7, 6]],),
                ([[0]],), ([[3, 2], [0, 1]],)]
    while True:
        n = rng.randint(1, 20 if rng.random() < 0.4 else 6)
        values = list(range(n * n))
        rng.shuffle(values)
        yield ([values[r * n:(r + 1) * n] for r in range(n)],)


def cherry_cases(rng):
    yield from [([[0, 1, -1], [1, 0, -1], [1, 1, 1]],), ([[1, 1, -1], [1, -1, 1], [-1, 1, 1]],), ([[1]],), ([[0]],),
                ([[1, 1, 1, 1], [0, 0, 0, 1], [1, 0, 0, 1], [1, 1, 1, 1]],)]
    while True:
        n = rng.randint(1, 6)
        wall, cherry = rng.choice([0.0, 0.1, 0.25, 0.4]), rng.choice([0.3, 0.6, 0.9])
        grid = [[-1 if rng.random() < wall else (1 if rng.random() < cherry else 0) for _ in range(n)] for _ in range(n)]
        for r, c in ((0, 0), (n - 1, n - 1)):
            if grid[r][c] == -1:
                grid[r][c] = rng.randint(0, 1)
        yield (grid,)


def split_cases(rng):
    yield from [([7, 2, 5, 10, 8], 2), ([1, 2, 3, 4, 5], 2), ([1, 4, 4], 3), ([0], 1), ([0, 0, 0], 2), ([1000000] * 5, 1)]
    while True:
        n = rng.randint(1, 60 if rng.random() < 0.5 else 8)
        hi = rng.choice([0, 10, 1000, 10**6])
        yield ([rng.randint(0, hi) for _ in range(n)], rng.randint(1, min(10, n)))


def shortest_pal_cases(rng):
    yield from [("aacecaaa",), ("abcd",), ("",), ("a",), ("aba",), ("ab",), ("aabba",)]
    while True:
        roll = rng.random()
        alpha = rng.choice(["a", "ab", "abc", "abcdefghij"])
        if roll < 0.4:
            half = rand_str(rng, rng.randint(0, 700 if rng.random() < 0.3 else 8), alpha)
            pal = half + (half[::-1] if rng.random() < 0.5 else half[-2::-1])
            s = pal + rand_str(rng, rng.randint(0, 100 if rng.random() < 0.3 else 5), alpha)
        else:
            s = rand_str(rng, rng.randint(0, 1500 if rng.random() < 0.3 else 12), alpha)
        yield (s,)


def max_points_cases(rng):
    yield from [([[1, 1], [2, 2], [3, 3]],), ([[1, 1], [3, 2], [5, 3], [4, 1], [2, 3], [1, 4]],), ([[0, 0]],), ([[0, 0], [1, 1]],),
                ([[0, 0], [0, 5], [0, -3], [2, 2]],), ([[-10000, -10000], [10000, 10000], [0, 0], [1, 2]],)]
    while True:
        span = rng.choice([5, 50, 10000])
        points = []
        for _ in range(rng.randint(0, 3)):
            x, y = rng.randint(-span, span), rng.randint(-span, span)
            dx, dy = rng.choice([(1, 0), (0, 1), (1, 1), (1, -1), (2, 1), (1, 3), (-3, 2)])
            for t in range(rng.randint(2, 15)):
                px, py = x + t * dx, y + t * dy
                if abs(px) <= 10000 and abs(py) <= 10000:
                    points.append((px, py))
        points += [(rng.randint(-span, span), rng.randint(-span, span)) for _ in range(rng.randint(1, 45))]
        points = list(dict.fromkeys(points))[:60]
        rng.shuffle(points)
        yield ([list(p) for p in points],)


def bridges_cases(rng):
    yield from [(4, [[0, 1], [1, 2], [2, 0], [1, 3]]), (2, [[0, 1]]), (3, [[0, 1], [1, 2], [2, 0]]),
                (6, [[0, 1], [1, 2], [2, 0], [1, 3], [3, 4], [4, 5], [5, 3]])]
    while True:
        n = rng.randint(2, 60 if rng.random() < 0.4 else 8)
        label = list(range(n))
        rng.shuffle(label)
        edges = {}
        for v in range(1, n):
            a, b = label[v], label[rng.randrange(v)]
            edges[(min(a, b), max(a, b))] = None
        for _ in range(rng.randint(0, n)):
            a, b = rng.sample(range(n), 2)
            edges[(min(a, b), max(a, b))] = None
        connections = [list(e) if rng.random() < 0.5 else [e[1], e[0]] for e in edges]
        rng.shuffle(connections)
        yield (n, connections)


def trap2_cases(rng):
    yield from [([[1, 4, 3, 1, 3, 2], [3, 2, 1, 3, 2, 4], [2, 3, 3, 2, 3, 1]],),
                ([[3, 3, 3, 3, 3], [3, 2, 2, 2, 3], [3, 2, 1, 2, 3], [3, 2, 2, 2, 3], [3, 3, 3, 3, 3]],), ([[5]],), ([[1, 2], [3, 4]],)]
    while True:
        m, n = rng.randint(1, 15), rng.randint(1, 15)
        hi = rng.choice([3, 20, 20000])
        yield ([[rng.randint(0, hi) for _ in range(n)] for _ in range(m)],)


def skyline_cases(rng):
    yield from [([[2, 9, 10], [3, 7, 15], [5, 12, 12], [15, 20, 10], [19, 24, 8]],), ([[0, 2, 3], [2, 5, 3]],), ([[1, 2, 1]],),
                ([[0, 2147483647, 2147483647]],), ([[1, 5, 3], [1, 5, 3], [1, 5, 3]],)]
    while True:
        n = rng.randint(1, 60 if rng.random() < 0.4 else 8)
        span, tall = rng.choice([(30, 10), (1000, 1000), (INT_MAX, INT_MAX)])
        buildings = []
        for _ in range(n):
            left = rng.randint(0, span - 1)
            right = rng.randint(left + 1, min(span, left + max(1, span // 3)))
            buildings.append([left, right, rng.randint(1, tall)])
        buildings.sort(key=lambda b: b[0])
        yield (buildings,)


def digit_one_cases(rng):
    yield from [(13,), (0,), (1,), (10,), (99,), (100,), (111,), (1000000000,), (999999999,), (199999,)]
    while True:
        roll = rng.random()
        if roll < 0.3:
            yield (rng.randint(0, 20000),)
        elif roll < 0.6:
            yield (int("".join(rng.choice("0111") for _ in range(rng.randint(1, 9)))),)
        else:
            yield (rng.randint(0, 10**9),)


def english_cases(rng):
    yield from [(123,), (12345,), (1234567,), (0,), (1000000,), (1000010,), (2147483647,), (100,), (20,), (1000000001,), (19,), (110,),
                (40,), (1040040,), (2000000045,)]
    while True:
        # Every tens word must appear often: a misspelled "Fourty" passed 47/50 before 40-49 was weighted in.
        chunks = [rng.choice([0, 0, rng.randint(1, 999), rng.randint(1, 19), rng.randint(1, 9) * 100,
                              rng.randint(20, 99), rng.randint(1, 9) * 100 + rng.randint(20, 99)]) for _ in range(4)]
        value = chunks[0] % 3 * 10**9 + chunks[1] * 10**6 + chunks[2] * 10**3 + chunks[3]
        if value <= INT_MAX:
            yield (value,)


def dungeon_cases(rng):
    yield from [([[-2, -3, 3], [-5, -10, 1], [10, 30, -5]],), ([[0]],), ([[-1000]],), ([[100]],), ([[1, -3, 3], [0, -2, 0], [-3, -3, -3]],)]
    while True:
        m, n = rng.randint(1, 20 if rng.random() < 0.4 else 5), rng.randint(1, 20 if rng.random() < 0.4 else 5)
        lo, hi = rng.choice([(-1000, 1000), (-10, 5), (-3, 3)])
        yield ([[rng.randint(lo, hi) for _ in range(n)] for _ in range(m)],)


def stock3_cases(rng):
    yield from [([3, 3, 5, 0, 0, 3, 1, 4],), ([1, 2, 3, 4, 5],), ([7, 6, 4, 3, 1],), ([1],), ([1, 2, 4, 2, 5, 7, 2, 4, 9, 0],)]
    while True:
        hi = rng.choice([5, 100, 100000])
        yield ([rng.randint(0, hi) for _ in range(rng.randint(1, 300 if rng.random() < 0.4 else 12))],)


def lfu_cases(rng):
    yield (["LFUCache", "put", "put", "get", "put", "get", "get", "put", "get", "get", "get"],
           [[2], [1, 1], [2, 2], [1], [3, 3], [2], [3], [4, 4], [1], [3], [4]])
    while True:
        if rng.random() < 0.3:
            # Tie rotation: fill the cache, touch every key the same number of times in a shuffled
            # order, then insert. Use counts tie at >= 2 while recency differs from insertion order,
            # so only the least-recently-used tie-break picks the right victim. Without these, a C
            # version that evicted the first stored key among ties passed 47/50.
            capacity = rng.randint(2, 5)
            keys = rng.sample(range(0, 50), capacity + rng.randint(1, 3))
            ops, args = ["LFUCache"], [[capacity]]
            for key in keys[:capacity]:
                ops.append("put")
                args.append([key, rng.randint(0, 10**9)])
            for _ in range(rng.randint(1, 3)):
                for key in rng.sample(keys[:capacity], capacity):
                    ops.append("get")
                    args.append([key])
            for key in keys[capacity:]:
                ops.append("put")
                args.append([key, rng.randint(0, 10**9)])
                for probe in keys:
                    ops.append("get")
                    args.append([probe])
            yield (ops, args)
            continue
        capacity = rng.randint(1, 10000) if rng.random() < 0.1 else rng.randint(1, 5)
        # capacity + 1 keys with put-heavy traffic makes use-count ties common, which is where
        # the least-recently-used tie-break decides the victim (a version ignoring it passed 47/50).
        key_hi = rng.choice([min(100000, capacity * 2 + 1), 8, 100000, capacity + 1])
        get_share = rng.choice([0.2, 0.5])
        ops, args = ["LFUCache"], [[capacity]]
        for _ in range(rng.randint(1, 400 if rng.random() < 0.4 else 20)):
            key = rng.randint(0, key_hi)
            if rng.random() < get_share:
                ops.append("get")
                args.append([key])
            else:
                ops.append("put")
                args.append([key, rng.randint(0, 10**9)])
        yield (ops, args)


# ── specs ────────────────────────────────────────────────────────────────

LFU_METHODS = [("get", [("key", "int")], "int"), ("put", [("key", "int"), ("value", "int")], "void")]

SPECS = [
    P(slug="minimum-number-of-refueling-stops", title="Minimum Number of Refueling Stops", number=871,
      topics=["array", "dynamic-programming", "greedy", "heap-priority-queue"],
      method="minRefuelStops", params=[("target", "int"), ("startFuel", "int"), ("stations", "int[][]")], ret="int",
      description="""
A car starts at position 0 and must reach position target, travelling in one direction. It uses one litre of fuel per mile and starts with startFuel litres; its tank has unlimited capacity.

Gas stations are given as stations[i] = [position_i, fuel_i], sorted by position. When the car reaches a station it may stop and take all of that station's fuel. Reaching a station or the target with exactly 0 fuel left still counts.

Return the minimum number of stops needed to reach target, or -1 if it is impossible.

Constraints:
- 1 <= target, startFuel <= 10^9
- 0 <= stations.length <= 500
- 1 <= position_i < position_{i+1} < target
- 1 <= fuel_i < 10^9""",
      hints=["You never need to decide at a station whether to stop; you can decide later, as if the fuel had been collected then.",
             "Drive as far as the current fuel allows, remembering every station passed along the way.",
             "When you would run dry, take fuel from the largest station passed so far (a max-heap). Totals can exceed 2^31, so use 64-bit integers."],
      templates=templates("minRefuelStops(self, target: int, startFuel: int, stations: List[List[int]]) -> int",
                          "int minRefuelStops(int target, int startFuel, vector<vector<int>>& stations)",
                          "int minRefuelStops(int target, int startFuel, int** stations, int stationsSize, int* stationsColSize)",
                          "int minRefuelStops(int target, int startFuel, int[][] stations)"),
      oracle=refuel_oracle, cases=refuel_cases),

    P(slug="swim-in-rising-water", title="Swim in Rising Water", number=778,
      topics=["array", "binary-search", "depth-first-search", "breadth-first-search", "union-find", "heap-priority-queue", "matrix"],
      method="swimInWater", params=[("grid", "int[][]")], ret="int",
      description="""
You are given an n x n grid where grid[i][j] is the elevation of cell (i, j). Rain starts falling, and at time t the water everywhere is at depth t.

You can swim from a cell to any 4-directionally adjacent cell if both cells have elevation at most t, and swimming itself takes no time. Starting at the top-left cell, return the least time t at which you can reach the bottom-right cell.

Constraints:
- n == grid.length
- n == grid[i].length
- 1 <= n <= 50
- 0 <= grid[i][j] < n^2
- Each value grid[i][j] is unique.""",
      hints=["The time needed for a route is the highest elevation along it, so you want the route whose highest cell is lowest.",
             "Whether a time t is enough is monotone in t, so you could binary search t with a BFS at each step.",
             "Better: a Dijkstra-style search with a min-heap keyed by the highest elevation seen so far reaches the corner with the answer directly."],
      templates=templates("swimInWater(self, grid: List[List[int]]) -> int", "int swimInWater(vector<vector<int>>& grid)",
                          "int swimInWater(int** grid, int gridSize, int* gridColSize)", "int swimInWater(int[][] grid)"),
      oracle=swim_oracle, cases=swim_cases),

    P(slug="cherry-pickup", title="Cherry Pickup", number=741,
      topics=["array", "dynamic-programming", "matrix"],
      method="cherryPickup", params=[("grid", "int[][]")], ret="int",
      description="""
You are given an n x n grid where each cell is 0 (empty), 1 (a cherry) or -1 (a thorn that blocks the way).

Start at (0, 0), walk to (n - 1, n - 1) moving only right or down through non-thorn cells, then walk back to (0, 0) moving only left or up. Every cherry you pass is picked up, and its cell becomes empty.

Return the maximum number of cherries you can collect. If there is no valid path from (0, 0) to (n - 1, n - 1), return 0.

Constraints:
- n == grid.length
- n == grid[i].length
- 1 <= n <= 50
- grid[i][j] is -1, 0, or 1.
- grid[0][0] != -1
- grid[n - 1][n - 1] != -1""",
      hints=["Maximising the outbound trip first and then the return trip is greedy, and it fails.",
             "The return trip is just another right/down path walked backwards, so think of two people walking from (0, 0) at the same time.",
             "After t steps both walkers are on the diagonal r + c = t, so the state (t, r1, r2) is enough; add both cells' cherries, counting a shared cell once."],
      templates=templates("cherryPickup(self, grid: List[List[int]]) -> int", "int cherryPickup(vector<vector<int>>& grid)",
                          "int cherryPickup(int** grid, int gridSize, int* gridColSize)", "int cherryPickup(int[][] grid)"),
      oracle=cherry_oracle, cases=cherry_cases),

    P(slug="split-array-largest-sum", title="Split Array Largest Sum", number=410,
      topics=["array", "binary-search", "dynamic-programming", "greedy", "prefix-sum"],
      method="splitArray", params=[("nums", "int[]"), ("k", "int")], ret="int",
      description="""
Given an integer array nums and an integer k, split nums into exactly k non-empty contiguous subarrays so that the largest subarray sum is as small as possible. Return that minimised largest sum.

Constraints:
- 1 <= nums.length <= 1000
- 0 <= nums[i] <= 10^6
- 1 <= k <= min(50, nums.length)""",
      hints=["Guess a limit L on the largest subarray sum. Can the array be split so that no part exceeds L?",
             "For a fixed L, greedily extend the current part until adding the next element would exceed L; this uses the fewest parts possible.",
             "Feasibility is monotone in L, so binary search L between max(nums) and sum(nums)."],
      templates=templates("splitArray(self, nums: List[int], k: int) -> int", "int splitArray(vector<int>& nums, int k)",
                          "int splitArray(int* nums, int numsSize, int k)", "int splitArray(int[] nums, int k)"),
      oracle=split_oracle, cases=split_cases),

    P(slug="n-queens-ii", title="N-Queens II", number=52, case_count=9,
      topics=["backtracking"],
      method="totalNQueens", params=[("n", "int")], ret="int",
      description="""
The n-queens puzzle asks you to place n queens on an n x n chessboard so that no two queens attack each other: no two share a row, a column, or a diagonal.

Given an integer n, return the number of distinct solutions.

Constraints:
- 1 <= n <= 9""",
      hints=["Exactly one queen goes in each row, so place them row by row.",
             "For each row, try every column that is not attacked by an earlier queen, and backtrack after exploring it.",
             "Track used columns and both diagonal directions (r + c and r - c) in sets or bitmasks to check attacks in O(1)."],
      templates=templates("totalNQueens(self, n: int) -> int", "int totalNQueens(int n)", "int totalNQueens(int n)", "int totalNQueens(int n)"),
      oracle=queens_oracle, cases=lambda rng: iter([(n,) for n in [4, 1, 2, 3, 5, 6, 7, 8, 9]])),

    P(slug="shortest-palindrome", title="Shortest Palindrome", number=214,
      topics=["string", "rolling-hash", "string-matching", "hash-function"],
      method="shortestPalindrome", params=[("s", "string")], ret="string",
      description="""
You are given a string s. You may add characters only to the front of s. Return the shortest palindrome you can form this way.

Constraints:
- 0 <= s.length <= 5 * 10^4
- s consists of lowercase English letters only.""",
      hints=["Whatever you add must mirror the part of s that follows its longest palindromic prefix.",
             "So the task reduces to finding the longest prefix of s that is a palindrome; checking every prefix directly is O(n^2).",
             "Build s + '#' + reverse(s) and compute the KMP failure function: its last value is the length of that longest palindromic prefix."],
      templates=templates("shortestPalindrome(self, s: str) -> str", "string shortestPalindrome(string s)",
                          "char* shortestPalindrome(char* s)", "String shortestPalindrome(String s)"),
      oracle=shortest_pal_oracle, cases=shortest_pal_cases),

    P(slug="max-points-on-a-line", title="Max Points on a Line", number=149,
      topics=["array", "hash-table", "math", "geometry"],
      method="maxPoints", params=[("points", "int[][]")], ret="int",
      description="""
Given an array points where points[i] = [x_i, y_i] is a point on the X-Y plane, return the maximum number of points that lie on the same straight line.

Constraints:
- 1 <= points.length <= 300
- points[i].length == 2
- -10^4 <= x_i, y_i <= 10^4
- All the points are unique.""",
      hints=["Fix one point as an anchor: every line through it is determined by a direction to another point.",
             "Points share a line through the anchor exactly when their directions from it are the same.",
             "Represent a direction exactly as (dx, dy) divided by their gcd with a normalised sign, count directions in a hash map, and avoid floating-point slopes."],
      templates=templates("maxPoints(self, points: List[List[int]]) -> int", "int maxPoints(vector<vector<int>>& points)",
                          "int maxPoints(int** points, int pointsSize, int* pointsColSize)", "int maxPoints(int[][] points)"),
      oracle=max_points_oracle, cases=max_points_cases),

    P(slug="critical-connections-in-a-network", title="Critical Connections in a Network", number=1192,
      unorderedOutput=True, unorderedInner=True,
      topics=["depth-first-search", "graph", "biconnected-component"],
      method="criticalConnections", params=[("n", "int"), ("connections", "int[][]")], ret="int[][]",
      description="""
There are n servers numbered from 0 to n - 1, joined by undirected connections where connections[i] = [a_i, b_i]. Every server can reach every other server, directly or indirectly.

A connection is critical if removing it would leave some server unable to reach some other server. Return all critical connections, in any order.

Constraints:
- 2 <= n <= 10^5
- n - 1 <= connections.length <= 10^5
- 0 <= a_i, b_i <= n - 1
- a_i != b_i
- There are no repeated connections.""",
      hints=["A connection is critical exactly when it lies on no cycle; such an edge is called a bridge.",
             "Removing each edge and re-checking connectivity works, but is O(E * (V + E)).",
             "Run one DFS that records each node's discovery time and the lowest discovery time reachable from its subtree (Tarjan's low-link); edge (u, v) is a bridge when low[v] > disc[u]."],
      templates=templates("criticalConnections(self, n: int, connections: List[List[int]]) -> List[List[int]]",
                          "vector<vector<int>> criticalConnections(int n, vector<vector<int>>& connections)",
                          "int** criticalConnections(int n, int** connections, int connectionsSize, int* connectionsColSize, int* returnSize, int** returnColumnSizes)",
                          "List<List<Integer>> criticalConnections(int n, List<List<Integer>> connections)", c_note=C_ARR2_NOTE),
      oracle=bridges_oracle, cases=bridges_cases),

    P(slug="trapping-rain-water-ii", title="Trapping Rain Water II", number=407,
      topics=["array", "breadth-first-search", "heap-priority-queue", "matrix"],
      method="trapRainWater", params=[("heightMap", "int[][]")], ret="int",
      description="""
You are given an m x n matrix heightMap, where heightMap[i][j] is the height of a unit cell of terrain. After it rains, water collects in low areas that are enclosed by higher terrain. Water that can reach the edge of the map flows away.

Return the total volume of water trapped.

Constraints:
- m == heightMap.length
- n == heightMap[i].length
- 1 <= m, n <= 200
- 0 <= heightMap[i][j] <= 2 * 10^4""",
      hints=["The water level over a cell is decided by the lowest point of the wall that surrounds it, not by its immediate neighbours alone.",
             "Start from the boundary cells, which can hold no water, and always expand inward from the lowest boundary cell (a min-heap).",
             "A neighbour lower than the current boundary height traps the difference; push it back with height max(its own height, boundary height)."],
      templates=templates("trapRainWater(self, heightMap: List[List[int]]) -> int", "int trapRainWater(vector<vector<int>>& heightMap)",
                          "int trapRainWater(int** heightMap, int heightMapSize, int* heightMapColSize)",
                          "int trapRainWater(int[][] heightMap)"),
      oracle=trap2_oracle, cases=trap2_cases),

    P(slug="the-skyline-problem", title="The Skyline Problem", number=218,
      topics=["array", "divide-and-conquer", "binary-indexed-tree", "segment-tree", "line-sweep", "heap-priority-queue", "ordered-set"],
      method="getSkyline", params=[("buildings", "int[][]")], ret="int[][]",
      description="""
A city's skyline is the outline formed by all its buildings seen from far away. Each building is buildings[i] = [left_i, right_i, height_i]: a rectangle on flat ground from x = left_i to x = right_i with the given height. The buildings are sorted by left_i.

Return the skyline as a list of key points [x, y], sorted by x. Each key point is the left end of a horizontal segment of the outline, and the last key point, where the rightmost building ends, has y = 0. The output must not contain consecutive key points with the same height.

Constraints:
- 1 <= buildings.length <= 10^4
- 0 <= left_i < right_i <= 2^31 - 1
- 1 <= height_i <= 2^31 - 1
- buildings is sorted by left_i in non-decreasing order.""",
      hints=["The outline can only change height at a building's left or right edge, so those x coordinates are the only candidates.",
             "Sweep the candidates in order, keeping the heights of buildings that cover the current x.",
             "A max-heap of (height, right edge) with lazy removal of expired buildings gives the current height; emit a key point whenever it changes."],
      templates=templates("getSkyline(self, buildings: List[List[int]]) -> List[List[int]]",
                          "vector<vector<int>> getSkyline(vector<vector<int>>& buildings)",
                          "int** getSkyline(int** buildings, int buildingsSize, int* buildingsColSize, int* returnSize, int** returnColumnSizes)",
                          "List<List<Integer>> getSkyline(int[][] buildings)", c_note=C_ARR2_NOTE),
      oracle=skyline_oracle, cases=skyline_cases),

    P(slug="number-of-digit-one", title="Number of Digit One", number=233,
      topics=["math", "dynamic-programming", "recursion"],
      method="countDigitOne", params=[("n", "int")], ret="int",
      description="""
Given an integer n, count the total number of times the digit 1 appears when you write out every integer from 0 to n.

Constraints:
- 0 <= n <= 10^9""",
      hints=["Counting digit by digit over every number is far too slow for n = 10^9.",
             "Count how often a 1 appears in each decimal position separately, then add the positions up.",
             "For a position with place value f, split n into the digits above it, the digit at it, and the digits below; the count depends on whether that digit is 0, 1, or larger."],
      templates=templates("countDigitOne(self, n: int) -> int", "int countDigitOne(int n)", "int countDigitOne(int n)", "int countDigitOne(int n)"),
      oracle=digit_one_oracle, cases=digit_one_cases),

    P(slug="integer-to-english-words", title="Integer to English Words", number=273,
      topics=["math", "string", "recursion"],
      method="numberToWords", params=[("num", "int")], ret="string",
      description="""
Convert a non-negative integer num to its English words representation, capitalising each word and separating words with single spaces, for example 12345 -> "Twelve Thousand Three Hundred Forty Five".

Constraints:
- 0 <= num <= 2^31 - 1""",
      hints=["English groups digits in threes: billions, millions, thousands, and the rest.",
             "Write a helper that converts a number below 1000, handling hundreds, the special words for 10 through 19, and tens.",
             "Apply it to each non-zero group followed by its scale word, and treat 0 (\"Zero\") as a special case."],
      templates=templates("numberToWords(self, num: int) -> str", "string numberToWords(int num)",
                          "char* numberToWords(int num)", "String numberToWords(int num)"),
      oracle=english_oracle, cases=english_cases),

    P(slug="dungeon-game", title="Dungeon Game", number=174,
      topics=["array", "dynamic-programming", "matrix"],
      method="calculateMinimumHP", params=[("dungeon", "int[][]")], ret="int",
      description="""
A knight starts in the top-left room of an m x n dungeon and must reach the princess in the bottom-right room, moving only right or down. Each room changes the knight's health by dungeon[i][j]: negative values are damage and positive values restore health. The first and last rooms also apply their values.

If the knight's health ever drops to 0 or below, he dies. Return the minimum initial health that lets the knight reach the princess.

Constraints:
- m == dungeon.length
- n == dungeon[i].length
- 1 <= m, n <= 200
- -1000 <= dungeon[i][j] <= 1000""",
      hints=["Working forwards is awkward: a path that is best so far can need more starting health later.",
             "Work backwards instead: let need[i][j] be the minimum health required on entering room (i, j) to finish from there.",
             "need[i][j] = max(1, min(need[i+1][j], need[i][j+1]) - dungeon[i][j]), with the room past the princess requiring 1."],
      templates=templates("calculateMinimumHP(self, dungeon: List[List[int]]) -> int", "int calculateMinimumHP(vector<vector<int>>& dungeon)",
                          "int calculateMinimumHP(int** dungeon, int dungeonSize, int* dungeonColSize)",
                          "int calculateMinimumHP(int[][] dungeon)"),
      oracle=dungeon_oracle, cases=dungeon_cases),

    P(slug="best-time-to-buy-and-sell-stock-iii", title="Best Time to Buy and Sell Stock III", number=123,
      topics=["array", "dynamic-programming"],
      method="maxProfit", params=[("prices", "int[]")], ret="int",
      description="""
You are given an array prices where prices[i] is a stock's price on day i. You may complete at most two transactions, where each transaction is a buy followed later by a sell, and you may hold at most one share at a time.

Return the maximum profit you can achieve.

Constraints:
- 1 <= prices.length <= 10^5
- 0 <= prices[i] <= 10^5""",
      hints=["Two transactions never overlap, so there is a day that separates the first from the second.",
             "Precompute the best single-transaction profit ending by each day and starting from each day, then try every split: O(n).",
             "Or keep four running values in one pass: best after first buy, first sell, second buy and second sell."],
      templates=templates("maxProfit(self, prices: List[int]) -> int", "int maxProfit(vector<int>& prices)",
                          "int maxProfit(int* prices, int pricesSize)", "int maxProfit(int[] prices)"),
      oracle=stock3_oracle, cases=stock3_cases),

    P(slug="lfu-cache", title="LFU Cache", number=460, design=True, className="LFUCache", ctor=[("capacity", "int")],
      methods=LFU_METHODS,
      topics=["hash-table", "linked-list", "design", "doubly-linked-list"],
      description="""
Design a cache with a fixed capacity that evicts the least frequently used entry when it is full.

Implement the LFUCache class:
- LFUCache(int capacity) creates a cache that holds at most capacity entries.
- int get(int key) returns the value for key, or -1 if key is absent.
- void put(int key, int value) stores value for key, replacing any existing value. If this adds a new key to a full cache, first remove the key with the lowest use count; if several keys tie, remove the one used least recently.

Every successful get and every put on a key counts as one use of that key. A newly inserted key starts with a use count of 1. get and put must each run in O(1) average time.

Constraints:
- 1 <= capacity <= 10^4
- 0 <= key <= 10^5
- 0 <= value <= 10^9
- At most 2 * 10^5 calls are made to get and put.""",
      hints=["Keep a hash map from key to (value, use count).",
             "Group keys by use count, and inside each group keep them in recency order, so both tie-break rules are available in O(1).",
             "Track the smallest non-empty use count. It only changes when that group empties after a use (it moves up by 1) or when a new key is inserted (it becomes 1)."],
      templates=design_templates("LFUCache", [("capacity", "int")], LFU_METHODS),
      oracle=lfu_oracle, cases=lfu_cases),
]


if __name__ == "__main__":
    write_all(SPECS)
