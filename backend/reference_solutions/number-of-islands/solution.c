int numIslands(char** grid, int gridSize, int* gridColSize) {
    if (gridSize == 0) return 0;
    int rows = gridSize, cols = gridColSize[0], count = 0;
    int* stack = (int*)malloc(sizeof(int) * (rows * cols + 1));
    int dr[] = {1, -1, 0, 0}, dc[] = {0, 0, 1, -1};
    for (int r = 0; r < rows; r++) {
        for (int c = 0; c < cols; c++) {
            if (grid[r][c] != '1') continue;
            count++;
            int top = 0;
            stack[top++] = r * cols + c;
            grid[r][c] = '0';
            while (top) {
                int cell = stack[--top], y = cell / cols, x = cell % cols;
                for (int d = 0; d < 4; d++) {
                    int ny = y + dr[d], nx = x + dc[d];
                    if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && grid[ny][nx] == '1') {
                        grid[ny][nx] = '0';
                        stack[top++] = ny * cols + nx;
                    }
                }
            }
        }
    }
    free(stack);
    return count;
}
