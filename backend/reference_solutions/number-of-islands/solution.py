class Solution:
    def numIslands(self, grid: List[List[str]]) -> int:
        if not grid:
            return 0
        rows, cols = len(grid), len(grid[0])
        count = 0
        for r in range(rows):
            for c in range(cols):
                if grid[r][c] != "1":
                    continue
                count += 1
                stack = [(r, c)]
                grid[r][c] = "0"
                while stack:
                    y, x = stack.pop()
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < rows and 0 <= nx < cols and grid[ny][nx] == "1":
                            grid[ny][nx] = "0"
                            stack.append((ny, nx))
        return count
