class Solution:
    def majorityElement(self, nums: List[int]) -> int:
        candidate, count = 0, 0
        for v in nums:
            if count == 0:
                candidate = v
            count += 1 if v == candidate else -1
        return candidate
