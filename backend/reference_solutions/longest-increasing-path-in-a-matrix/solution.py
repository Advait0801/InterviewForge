class Solution:
    def longestIncreasingPath(self, matrix: List[List[int]]) -> int:
        m, n = len(matrix), len(matrix[0])
        memo = [[0] * n for _ in range(m)]
        def longest(r, c):
            if memo[r][c]:
                return memo[r][c]
            best = 1
            for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                if 0 <= nr < m and 0 <= nc < n and matrix[nr][nc] > matrix[r][c]:
                    best = max(best, 1 + longest(nr, nc))
            memo[r][c] = best
            return best
        return max(longest(r, c) for r in range(m) for c in range(n))
