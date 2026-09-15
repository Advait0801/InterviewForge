class Solution:
    def splitArray(self, nums: List[int], k: int) -> int:
        lo, hi = max(nums), sum(nums)
        while lo < hi:
            mid = (lo + hi) // 2
            pieces, current = 1, 0
            for v in nums:
                if current + v > mid:
                    pieces += 1
                    current = 0
                current += v
            if pieces <= k:
                hi = mid
            else:
                lo = mid + 1
        return lo
