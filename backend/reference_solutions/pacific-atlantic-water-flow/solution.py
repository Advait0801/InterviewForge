class Solution:
    def pacificAtlantic(self, heights: List[List[int]]) -> List[List[int]]:
        m, n = len(heights), len(heights[0])
        def climb(starts):
            seen, stack = set(starts), list(starts)
            while stack:
                r, c = stack.pop()
                for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                    if 0 <= nr < m and 0 <= nc < n and (nr, nc) not in seen and heights[nr][nc] >= heights[r][c]:
                        seen.add((nr, nc))
                        stack.append((nr, nc))
            return seen
        pacific = climb([(r, 0) for r in range(m)] + [(0, c) for c in range(n)])
        atlantic = climb([(r, n - 1) for r in range(m)] + [(m - 1, c) for c in range(n)])
        return [[r, c] for r in range(m) for c in range(n) if (r, c) in pacific and (r, c) in atlantic]
