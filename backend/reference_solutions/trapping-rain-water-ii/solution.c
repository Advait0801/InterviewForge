static void minHeapPush(long long* h, int* size, long long v) {
    int i = (*size)++;
    h[i] = v;
    while (i > 0 && h[(i - 1) / 2] > h[i]) { int p = (i - 1) / 2; long long t = h[p]; h[p] = h[i]; h[i] = t; i = p; }
}
static long long minHeapPop(long long* h, int* size) {
    long long top = h[0];
    h[0] = h[--(*size)];
    for (int i = 0;;) {
        int l = 2 * i + 1, r = l + 1, small = i;
        if (l < *size && h[l] < h[small]) small = l;
        if (r < *size && h[r] < h[small]) small = r;
        if (small == i) break;
        long long t = h[i]; h[i] = h[small]; h[small] = t; i = small;
    }
    return top;
}
int trapRainWater(int** heightMap, int heightMapSize, int* heightMapColSize) {
    int m = heightMapSize, n = heightMapColSize[0];
    if (m < 3 || n < 3) return 0;
    const long long SHIFT = 1LL << 20;  /* cell index m*n <= 40000 < 2^20 */
    long long* heap = (long long*)malloc((size_t)m * n * sizeof(long long));
    bool* seen = (bool*)calloc(m * n, sizeof(bool));
    int size = 0, water = 0;
    for (int r = 0; r < m; r++)
        for (int c = 0; c < n; c++)
            if (r == 0 || r == m - 1 || c == 0 || c == n - 1) {
                minHeapPush(heap, &size, heightMap[r][c] * SHIFT + (r * n + c));
                seen[r * n + c] = true;
            }
    static const int dr[4] = {1, -1, 0, 0}, dc[4] = {0, 0, 1, -1};
    while (size) {
        long long top = minHeapPop(heap, &size);
        int level = (int)(top / SHIFT), idx = (int)(top % SHIFT), r = idx / n, c = idx % n;
        for (int d = 0; d < 4; d++) {
            int nr = r + dr[d], nc = c + dc[d];
            if (nr < 0 || nr >= m || nc < 0 || nc >= n || seen[nr * n + nc]) continue;
            seen[nr * n + nc] = true;
            int h = heightMap[nr][nc];
            if (h < level) water += level - h;
            minHeapPush(heap, &size, (h > level ? h : level) * SHIFT + (nr * n + nc));
        }
    }
    free(heap);
    free(seen);
    return water;
}
