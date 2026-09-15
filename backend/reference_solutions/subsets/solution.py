class Solution:
    def subsets(self, nums: List[int]) -> List[List[int]]:
        out = [[]]
        for v in nums:
            out += [s + [v] for s in out]
        return out
