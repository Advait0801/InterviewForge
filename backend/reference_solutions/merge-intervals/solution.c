static int byStart(const void* a, const void* b) {
    int x = (*(int**)a)[0], y = (*(int**)b)[0];
    return (x > y) - (x < y);
}
int** merge(int** intervals, int intervalsSize, int* intervalsColSize, int* returnSize, int** returnColumnSizes) {
    qsort(intervals, intervalsSize, sizeof(int*), byStart);
    int** out = (int**)malloc(intervalsSize * sizeof(int*));
    *returnColumnSizes = (int*)malloc(intervalsSize * sizeof(int));
    int k = 0;
    for (int i = 0; i < intervalsSize; i++) {
        if (k && intervals[i][0] <= out[k - 1][1]) {
            if (intervals[i][1] > out[k - 1][1]) out[k - 1][1] = intervals[i][1];
        } else {
            out[k] = (int*)malloc(2 * sizeof(int));
            out[k][0] = intervals[i][0];
            out[k][1] = intervals[i][1];
            (*returnColumnSizes)[k++] = 2;
        }
    }
    *returnSize = k;
    return out;
}
