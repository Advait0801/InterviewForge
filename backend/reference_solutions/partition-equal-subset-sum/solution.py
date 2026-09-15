class Solution:
    def canPartition(self, nums: List[int]) -> bool:
        total = sum(nums)
        if total % 2:
            return False
        half = total // 2
        reachable = [True] + [False] * half
        for v in nums:
            for s in range(half, v - 1, -1):
                reachable[s] = reachable[s] or reachable[s - v]
        return reachable[half]
