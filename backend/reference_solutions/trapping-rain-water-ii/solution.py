import heapq

class Solution:
    def trapRainWater(self, heightMap: List[List[int]]) -> int:
        m, n = len(heightMap), len(heightMap[0])
        if m < 3 or n < 3:
            return 0
        heap, seen = [], [[False] * n for _ in range(m)]
        for r in range(m):
            for c in range(n):
                if r in (0, m - 1) or c in (0, n - 1):
                    heapq.heappush(heap, (heightMap[r][c], r, c))
                    seen[r][c] = True
        water = 0
        while heap:
            level, r, c = heapq.heappop(heap)
            for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                if 0 <= nr < m and 0 <= nc < n and not seen[nr][nc]:
                    seen[nr][nc] = True
                    water += max(0, level - heightMap[nr][nc])
                    heapq.heappush(heap, (max(level, heightMap[nr][nc]), nr, nc))
        return water
