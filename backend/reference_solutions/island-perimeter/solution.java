class Solution {
    public int islandPerimeter(int[][] grid) {
        int land = 0, shared = 0;
        for (int r = 0; r < grid.length; r++) {
            for (int c = 0; c < grid[r].length; c++) {
                if (grid[r][c] == 0) continue;
                land++;
                if (r + 1 < grid.length && grid[r + 1][c] == 1) shared++;
                if (c + 1 < grid[r].length && grid[r][c + 1] == 1) shared++;
            }
        }
        return 4 * land - 2 * shared;
    }
}
