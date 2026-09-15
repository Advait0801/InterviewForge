static bool swimReach(int** g, int n, int t, int r, int c, bool* seen) {
    if (r < 0 || r >= n || c < 0 || c >= n || seen[r * n + c] || g[r][c] > t) return false;
    if (r == n - 1 && c == n - 1) return true;
    seen[r * n + c] = true;
    return swimReach(g, n, t, r + 1, c, seen) || swimReach(g, n, t, r - 1, c, seen)
        || swimReach(g, n, t, r, c + 1, seen) || swimReach(g, n, t, r, c - 1, seen);
}
int swimInWater(int** grid, int gridSize, int* gridColSize) {
    int n = gridSize, lo = 0, hi = n * n - 1;
    bool* seen = (bool*)malloc(n * n * sizeof(bool));
    while (lo < hi) {
        int mid = (lo + hi) / 2;
        memset(seen, 0, n * n * sizeof(bool));
        if (swimReach(grid, n, mid, 0, 0, seen)) hi = mid; else lo = mid + 1;
    }
    free(seen);
    return lo;
}
