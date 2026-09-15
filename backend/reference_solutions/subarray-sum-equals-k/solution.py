class Solution:
    def subarraySum(self, nums: List[int], k: int) -> int:
        seen = {0: 1}
        total = count = 0
        for v in nums:
            total += v
            count += seen.get(total - k, 0)
            seen[total] = seen.get(total, 0) + 1
        return count
