class Solution:
    def maxProfit(self, prices: List[int]) -> int:
        best, low = 0, float("inf")
        for p in prices:
            low = min(low, p)
            best = max(best, p - low)
        return best
