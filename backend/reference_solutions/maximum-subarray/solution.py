class Solution:
    def maxSubArray(self, nums: List[int]) -> int:
        best = current = nums[0]
        for n in nums[1:]:
            current = max(n, current + n)
            best = max(best, current)
        return best
