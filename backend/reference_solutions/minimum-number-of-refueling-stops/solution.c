static void maxHeapPush(int* h, int* size, int v) {
    int i = (*size)++;
    h[i] = v;
    while (i > 0 && h[(i - 1) / 2] < h[i]) { int p = (i - 1) / 2, t = h[p]; h[p] = h[i]; h[i] = t; i = p; }
}
static int maxHeapPop(int* h, int* size) {
    int top = h[0];
    h[0] = h[--(*size)];
    for (int i = 0;;) {
        int l = 2 * i + 1, r = l + 1, big = i;
        if (l < *size && h[l] > h[big]) big = l;
        if (r < *size && h[r] > h[big]) big = r;
        if (big == i) break;
        int t = h[i]; h[i] = h[big]; h[big] = t; i = big;
    }
    return top;
}
int minRefuelStops(int target, int startFuel, int** stations, int stationsSize, int* stationsColSize) {
    int* heap = (int*)malloc((stationsSize + 1) * sizeof(int));
    int size = 0, stops = 0, i = 0;
    long long reach = startFuel;
    while (reach < target) {
        while (i < stationsSize && stations[i][0] <= reach) { maxHeapPush(heap, &size, stations[i][1]); i++; }
        if (size == 0) { stops = -1; break; }
        reach += maxHeapPop(heap, &size);
        stops++;
    }
    free(heap);
    return stops;
}
