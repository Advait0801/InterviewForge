class Solution:
    def islandPerimeter(self, grid: List[List[int]]) -> int:
        land = shared = 0
        for r in range(len(grid)):
            for c in range(len(grid[0])):
                if grid[r][c]:
                    land += 1
                    if r + 1 < len(grid) and grid[r + 1][c]:
                        shared += 1
                    if c + 1 < len(grid[0]) and grid[r][c + 1]:
                        shared += 1
        return 4 * land - 2 * shared
