static int byEnd(const void* a, const void* b) {
    int x = (*(int**)a)[1], y = (*(int**)b)[1];
    return (x > y) - (x < y);
}
int eraseOverlapIntervals(int** intervals, int intervalsSize, int* intervalsColSize) {
    qsort(intervals, intervalsSize, sizeof(int*), byEnd);
    int removed = 0;
    long long lastEnd = -1000000000LL;
    for (int i = 0; i < intervalsSize; i++) {
        if (intervals[i][0] >= lastEnd) lastEnd = intervals[i][1];
        else removed++;
    }
    return removed;
}
