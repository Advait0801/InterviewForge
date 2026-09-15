class Solution:
    def longestConsecutive(self, nums: List[int]) -> int:
        values = set(nums)
        best = 0
        for v in values:
            if v - 1 not in values:
                length = 1
                while v + length in values:
                    length += 1
                best = max(best, length)
        return best
