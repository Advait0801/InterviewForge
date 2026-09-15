static int lipLongest(int** mat, int m, int n, int r, int c, int* memo) {
    static const int dr[4] = {1, -1, 0, 0}, dc[4] = {0, 0, 1, -1};
    if (memo[r * n + c]) return memo[r * n + c];
    int best = 1;
    for (int d = 0; d < 4; d++) {
        int nr = r + dr[d], nc = c + dc[d];
        if (nr >= 0 && nr < m && nc >= 0 && nc < n && mat[nr][nc] > mat[r][c]) {
            int len = 1 + lipLongest(mat, m, n, nr, nc, memo);
            if (len > best) best = len;
        }
    }
    memo[r * n + c] = best;
    return best;
}
int longestIncreasingPath(int** matrix, int matrixSize, int* matrixColSize) {
    int m = matrixSize, n = matrixColSize[0], best = 0;
    int* memo = (int*)calloc(m * n, sizeof(int));
    for (int r = 0; r < m; r++)
        for (int c = 0; c < n; c++) {
            int len = lipLongest(matrix, m, n, r, c, memo);
            if (len > best) best = len;
        }
    free(memo);
    return best;
}
