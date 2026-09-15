class Solution:
    def rob(self, nums: List[int]) -> int:
        def line(lo, hi):
            take = skip = 0
            for v in nums[lo:hi]:
                take, skip = skip + v, max(take, skip)
            return max(take, skip)
        if len(nums) == 1:
            return nums[0]
        return max(line(0, len(nums) - 1), line(1, len(nums)))
