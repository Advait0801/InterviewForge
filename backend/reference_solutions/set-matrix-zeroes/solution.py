class Solution:
    def setZeroes(self, matrix: List[List[int]]) -> None:
        m, n = len(matrix), len(matrix[0])
        first_col_zero = any(matrix[r][0] == 0 for r in range(m))
        for r in range(m):
            for c in range(1, n):
                if matrix[r][c] == 0:
                    matrix[r][0] = matrix[0][c] = 0
        for r in range(m - 1, -1, -1):
            for c in range(n - 1, 0, -1):
                if matrix[r][0] == 0 or matrix[0][c] == 0:
                    matrix[r][c] = 0
            if first_col_zero:
                matrix[r][0] = 0
