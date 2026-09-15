import heapq

class Solution:
    def minRefuelStops(self, target: int, startFuel: int, stations: List[List[int]]) -> int:
        heap, reach, stops, i = [], startFuel, 0, 0
        while reach < target:
            while i < len(stations) and stations[i][0] <= reach:
                heapq.heappush(heap, -stations[i][1])
                i += 1
            if not heap:
                return -1
            reach -= heapq.heappop(heap)
            stops += 1
        return stops
