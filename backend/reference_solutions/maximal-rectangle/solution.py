class Solution:
    def maximalRectangle(self, matrix: List[List[str]]) -> int:
        n = len(matrix[0])
        heights = [0] * (n + 1)  # trailing 0 flushes the stack
        best = 0
        for row in matrix:
            for c in range(n):
                heights[c] = heights[c] + 1 if row[c] == "1" else 0
            stack = [-1]
            for c in range(n + 1):
                while stack[-1] != -1 and heights[stack[-1]] >= heights[c]:
                    h = heights[stack.pop()]
                    best = max(best, h * (c - stack[-1] - 1))
                stack.append(c)
        return best
