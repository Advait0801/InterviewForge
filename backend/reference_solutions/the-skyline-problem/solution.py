import heapq

class Solution:
    def getSkyline(self, buildings: List[List[int]]) -> List[List[int]]:
        xs = sorted({x for b in buildings for x in (b[0], b[1])})
        out, heap, i = [], [], 0  # heap of (-height, right)
        for x in xs:
            while i < len(buildings) and buildings[i][0] <= x:
                heapq.heappush(heap, (-buildings[i][2], buildings[i][1]))
                i += 1
            while heap and heap[0][1] <= x:
                heapq.heappop(heap)
            height = -heap[0][0] if heap else 0
            if not out or out[-1][1] != height:
                out.append([x, height])
        return out
