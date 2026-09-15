class Solution:
    def cherryPickup(self, grid: List[List[int]]) -> int:
        n = len(grid)
        neg = float("-inf")
        dp = [[neg] * n for _ in range(n)]  # dp[r1][r2]: best total with walkers at (r1, step - r1), (r2, step - r2)
        dp[0][0] = grid[0][0]
        for step in range(1, 2 * n - 1):
            nxt = [[neg] * n for _ in range(n)]
            for r1 in range(max(0, step - n + 1), min(n - 1, step) + 1):
                c1 = step - r1
                if grid[r1][c1] == -1:
                    continue
                for r2 in range(max(0, step - n + 1), min(n - 1, step) + 1):
                    c2 = step - r2
                    if grid[r2][c2] == -1:
                        continue
                    best = max(dp[r1][r2],
                               dp[r1 - 1][r2] if r1 else neg,
                               dp[r1][r2 - 1] if r2 else neg,
                               dp[r1 - 1][r2 - 1] if r1 and r2 else neg)
                    if best == neg:
                        continue
                    nxt[r1][r2] = best + grid[r1][c1] + (grid[r2][c2] if r1 != r2 else 0)
            dp = nxt
        return max(0, dp[n - 1][n - 1])
