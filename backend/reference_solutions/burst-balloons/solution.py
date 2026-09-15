class Solution:
    def maxCoins(self, nums: List[int]) -> int:
        vals = [1] + nums + [1]
        n = len(vals)
        dp = [[0] * n for _ in range(n)]
        for gap in range(2, n):
            for left in range(n - gap):
                right = left + gap
                for last in range(left + 1, right):
                    dp[left][right] = max(dp[left][right],
                                          vals[left] * vals[last] * vals[right] + dp[left][last] + dp[last][right])
        return dp[0][n - 1]
