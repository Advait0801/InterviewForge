int islandPerimeter(int** grid, int gridSize, int* gridColSize) {
    int land = 0, shared = 0;
    for (int r = 0; r < gridSize; r++) {
        for (int c = 0; c < gridColSize[r]; c++) {
            if (!grid[r][c]) continue;
            land++;
            if (r + 1 < gridSize && grid[r + 1][c]) shared++;
            if (c + 1 < gridColSize[r] && grid[r][c + 1]) shared++;
        }
    }
    return 4 * land - 2 * shared;
}
