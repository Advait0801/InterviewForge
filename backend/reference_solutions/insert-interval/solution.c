static int* pair2(int a, int b) {
    int* p = (int*)malloc(2 * sizeof(int));
    p[0] = a;
    p[1] = b;
    return p;
}
int** insert(int** intervals, int intervalsSize, int* intervalsColSize, int* newInterval, int newIntervalSize, int* returnSize, int** returnColumnSizes) {
    int** out = (int**)malloc((intervalsSize + 1) * sizeof(int*));
    *returnColumnSizes = (int*)malloc((intervalsSize + 1) * sizeof(int));
    int k = 0, i = 0, start = newInterval[0], end = newInterval[1];
    while (i < intervalsSize && intervals[i][1] < start) { out[k] = pair2(intervals[i][0], intervals[i][1]); (*returnColumnSizes)[k++] = 2; i++; }
    while (i < intervalsSize && intervals[i][0] <= end) {
        if (intervals[i][0] < start) start = intervals[i][0];
        if (intervals[i][1] > end) end = intervals[i][1];
        i++;
    }
    out[k] = pair2(start, end);
    (*returnColumnSizes)[k++] = 2;
    while (i < intervalsSize) { out[k] = pair2(intervals[i][0], intervals[i][1]); (*returnColumnSizes)[k++] = 2; i++; }
    *returnSize = k;
    return out;
}
