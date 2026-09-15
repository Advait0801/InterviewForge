import bisect

class Solution:
    def lengthOfLIS(self, nums: List[int]) -> int:
        tails = []
        for v in nums:
            i = bisect.bisect_left(tails, v)
            if i == len(tails):
                tails.append(v)
            else:
                tails[i] = v
        return len(tails)
