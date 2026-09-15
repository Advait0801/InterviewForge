class Solution:
    def maxProduct(self, nums: List[int]) -> int:
        hi = lo = best = nums[0]
        for v in nums[1:]:
            candidates = (v, hi * v, lo * v)
            hi, lo = max(candidates), min(candidates)
            best = max(best, hi)
        return best
