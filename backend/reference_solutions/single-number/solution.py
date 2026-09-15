class Solution:
    def singleNumber(self, nums: List[int]) -> int:
        acc = 0
        for v in nums:
            acc ^= v
        return acc
