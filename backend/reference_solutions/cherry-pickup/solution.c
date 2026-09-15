int cherryPickup(int** grid, int gridSize, int* gridColSize) {
    int n = gridSize;
    const int NEG = -1000000000;
    int* dp = (int*)malloc(n * n * sizeof(int));
    int* next = (int*)malloc(n * n * sizeof(int));
    for (int i = 0; i < n * n; i++) dp[i] = NEG;
    dp[0] = grid[0][0];
    for (int step = 1; step <= 2 * n - 2; step++) {
        for (int i = 0; i < n * n; i++) next[i] = NEG;
        int lo = step - n + 1 > 0 ? step - n + 1 : 0, hi = step < n - 1 ? step : n - 1;
        for (int r1 = lo; r1 <= hi; r1++) {
            int c1 = step - r1;
            if (grid[r1][c1] == -1) continue;
            for (int r2 = lo; r2 <= hi; r2++) {
                int c2 = step - r2;
                if (grid[r2][c2] == -1) continue;
                int best = dp[r1 * n + r2];
                if (r1 && dp[(r1 - 1) * n + r2] > best) best = dp[(r1 - 1) * n + r2];
                if (r2 && dp[r1 * n + r2 - 1] > best) best = dp[r1 * n + r2 - 1];
                if (r1 && r2 && dp[(r1 - 1) * n + r2 - 1] > best) best = dp[(r1 - 1) * n + r2 - 1];
                if (best == NEG) continue;
                next[r1 * n + r2] = best + grid[r1][c1] + (r1 != r2 ? grid[r2][c2] : 0);
            }
        }
        int* t = dp; dp = next; next = t;
    }
    int result = dp[n * n - 1];
    free(dp);
    free(next);
    return result < 0 ? 0 : result;
}
