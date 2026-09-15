int calculateMinimumHP(int** dungeon, int dungeonSize, int* dungeonColSize) {
    int m = dungeonSize, n = dungeonColSize[0], w = n + 1;
    int* need = (int*)malloc((m + 1) * w * sizeof(int));
    for (int i = 0; i < (m + 1) * w; i++) need[i] = 1000000000;
    need[m * w + n - 1] = need[(m - 1) * w + n] = 1;
    for (int r = m - 1; r >= 0; r--)
        for (int c = n - 1; c >= 0; c--) {
            int below = need[(r + 1) * w + c], right = need[r * w + c + 1];
            int v = (below < right ? below : right) - dungeon[r][c];
            need[r * w + c] = v < 1 ? 1 : v;
        }
    int result = need[0];
    free(need);
    return result;
}
