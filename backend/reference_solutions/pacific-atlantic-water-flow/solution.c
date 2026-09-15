static void paClimb(int** h, int m, int n, int r, int c, bool* seen) {
    static const int dr[4] = {1, -1, 0, 0}, dc[4] = {0, 0, 1, -1};
    seen[r * n + c] = true;
    for (int d = 0; d < 4; d++) {
        int nr = r + dr[d], nc = c + dc[d];
        if (nr >= 0 && nr < m && nc >= 0 && nc < n && !seen[nr * n + nc] && h[nr][nc] >= h[r][c])
            paClimb(h, m, n, nr, nc, seen);
    }
}
int** pacificAtlantic(int** heights, int heightsSize, int* heightsColSize, int* returnSize, int** returnColumnSizes) {
    int m = heightsSize, n = heightsColSize[0];
    bool* pacific = (bool*)calloc(m * n, sizeof(bool));
    bool* atlantic = (bool*)calloc(m * n, sizeof(bool));
    for (int r = 0; r < m; r++) {
        if (!pacific[r * n]) paClimb(heights, m, n, r, 0, pacific);
        if (!atlantic[r * n + n - 1]) paClimb(heights, m, n, r, n - 1, atlantic);
    }
    for (int c = 0; c < n; c++) {
        if (!pacific[c]) paClimb(heights, m, n, 0, c, pacific);
        if (!atlantic[(m - 1) * n + c]) paClimb(heights, m, n, m - 1, c, atlantic);
    }
    int** out = (int**)malloc(m * n * sizeof(int*));
    *returnColumnSizes = (int*)malloc(m * n * sizeof(int));
    int k = 0;
    for (int r = 0; r < m; r++)
        for (int c = 0; c < n; c++)
            if (pacific[r * n + c] && atlantic[r * n + c]) {
                out[k] = (int*)malloc(2 * sizeof(int));
                out[k][0] = r;
                out[k][1] = c;
                (*returnColumnSizes)[k++] = 2;
            }
    free(pacific);
    free(atlantic);
    *returnSize = k;
    return out;
}
