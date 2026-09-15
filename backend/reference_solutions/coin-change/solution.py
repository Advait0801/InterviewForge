class Solution:
    def coinChange(self, coins: List[int], amount: int) -> int:
        inf = amount + 1
        dp = [0] + [inf] * amount
        for a in range(1, amount + 1):
            for coin in coins:
                if coin <= a and dp[a - coin] + 1 < dp[a]:
                    dp[a] = dp[a - coin] + 1
        return dp[amount] if dp[amount] != inf else -1
