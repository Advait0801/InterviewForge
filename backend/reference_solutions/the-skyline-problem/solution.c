static int cmpLongLong(const void* a, const void* b) {
    long long x = *(const long long*)a, y = *(const long long*)b;
    return (x > y) - (x < y);
}
static void skyPush(long long* h, int* size, long long v) {
    int i = (*size)++;
    h[i] = v;
    while (i > 0 && h[(i - 1) / 2] < h[i]) { int p = (i - 1) / 2; long long t = h[p]; h[p] = h[i]; h[i] = t; i = p; }
}
static void skyPop(long long* h, int* size) {
    h[0] = h[--(*size)];
    for (int i = 0;;) {
        int l = 2 * i + 1, r = l + 1, big = i;
        if (l < *size && h[l] > h[big]) big = l;
        if (r < *size && h[r] > h[big]) big = r;
        if (big == i) break;
        long long t = h[i]; h[i] = h[big]; h[big] = t; i = big;
    }
}
int** getSkyline(int** buildings, int buildingsSize, int* buildingsColSize, int* returnSize, int** returnColumnSizes) {
    const long long BASE = 2147483648LL;  /* heap key = height * 2^31 + right */
    int events = 2 * buildingsSize, bi = 0, size = 0, count = 0;
    long long* xs = (long long*)malloc(events * sizeof(long long));
    for (int i = 0; i < buildingsSize; i++) { xs[2 * i] = buildings[i][0]; xs[2 * i + 1] = buildings[i][1]; }
    qsort(xs, events, sizeof(long long), cmpLongLong);
    long long* heap = (long long*)malloc((buildingsSize + 1) * sizeof(long long));
    int** out = (int**)malloc(events * sizeof(int*));
    *returnColumnSizes = (int*)malloc(events * sizeof(int));
    for (int k = 0; k < events; k++) {
        if (k && xs[k] == xs[k - 1]) continue;
        long long x = xs[k];
        while (bi < buildingsSize && buildings[bi][0] <= x) {
            skyPush(heap, &size, (long long)buildings[bi][2] * BASE + buildings[bi][1]);
            bi++;
        }
        while (size && heap[0] % BASE <= x) skyPop(heap, &size);
        int height = size ? (int)(heap[0] / BASE) : 0;
        if (count == 0 || out[count - 1][1] != height) {
            out[count] = (int*)malloc(2 * sizeof(int));
            out[count][0] = (int)x;
            out[count][1] = height;
            (*returnColumnSizes)[count++] = 2;
        }
    }
    free(xs);
    free(heap);
    *returnSize = count;
    return out;
}
