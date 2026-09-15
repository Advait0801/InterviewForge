import heapq

class Solution:
    def swimInWater(self, grid: List[List[int]]) -> int:
        n = len(grid)
        heap, seen = [(grid[0][0], 0, 0)], {(0, 0)}
        while heap:
            t, r, c = heapq.heappop(heap)
            if r == n - 1 and c == n - 1:
                return t
            for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                if 0 <= nr < n and 0 <= nc < n and (nr, nc) not in seen:
                    seen.add((nr, nc))
                    heapq.heappush(heap, (max(t, grid[nr][nc]), nr, nc))
