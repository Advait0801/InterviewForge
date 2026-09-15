class Solution:
    def findTargetSumWays(self, nums: List[int], target: int) -> int:
        ways = {0: 1}
        for v in nums:
            nxt = {}
            for s, count in ways.items():
                nxt[s + v] = nxt.get(s + v, 0) + count
                nxt[s - v] = nxt.get(s - v, 0) + count
            ways = nxt
        return ways.get(target, 0)
