class Solution:
    def canCompleteCircuit(self, gas: List[int], cost: List[int]) -> int:
        total = tank = start = 0
        for i in range(len(gas)):
            delta = gas[i] - cost[i]
            total += delta
            tank += delta
            if tank < 0:
                start, tank = i + 1, 0
        return -1 if total < 0 else start
