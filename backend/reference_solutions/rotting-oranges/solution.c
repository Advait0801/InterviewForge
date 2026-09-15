int orangesRotting(int** grid, int gridSize, int* gridColSize) {
    int rows = gridSize, cols = gridColSize[0], fresh = 0, head = 0, tail = 0;
    int* q = (int*)malloc(sizeof(int) * (rows * cols + 1));
    for (int r = 0; r < rows; r++)
        for (int c = 0; c < cols; c++) {
            if (grid[r][c] == 2) q[tail++] = r * cols + c;
            else if (grid[r][c] == 1) fresh++;
        }
    int minutes = 0;
    int dr[] = {1, -1, 0, 0}, dc[] = {0, 0, 1, -1};
    while (head < tail && fresh > 0) {
        int end = tail;
        while (head < end) {
            int cell = q[head++], r = cell / cols, c = cell % cols;
            for (int d = 0; d < 4; d++) {
                int nr = r + dr[d], nc = c + dc[d];
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] == 1) {
                    grid[nr][nc] = 2;
                    fresh--;
                    q[tail++] = nr * cols + nc;
                }
            }
        }
        minutes++;
    }
    free(q);
    return fresh ? -1 : minutes;
}
