static void provVisit(int** g, int n, int i, bool* seen) {
    seen[i] = true;
    for (int j = 0; j < n; j++)
        if (g[i][j] && !seen[j]) provVisit(g, n, j, seen);
}
int findCircleNum(int** isConnected, int isConnectedSize, int* isConnectedColSize) {
    bool* seen = (bool*)calloc(isConnectedSize, sizeof(bool));
    int count = 0;
    for (int i = 0; i < isConnectedSize; i++)
        if (!seen[i]) { count++; provVisit(isConnected, isConnectedSize, i, seen); }
    free(seen);
    return count;
}
