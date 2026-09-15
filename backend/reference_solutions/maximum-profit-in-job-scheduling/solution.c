static int _cmp_job(const void* a, const void* b) {
    const int* x = (const int*)a;
    const int* y = (const int*)b;
    return (x[0] > y[0]) - (x[0] < y[0]);
}

int jobScheduling(int* startTime, int startTimeSize, int* endTime, int endTimeSize, int* profit, int profitSize) {
    int n = startTimeSize;
    int* jobs = (int*)malloc(sizeof(int) * 3 * n);
    for (int i = 0; i < n; i++) { jobs[3 * i] = endTime[i]; jobs[3 * i + 1] = startTime[i]; jobs[3 * i + 2] = profit[i]; }
    qsort(jobs, n, sizeof(int) * 3, _cmp_job);
    long long* dp = (long long*)calloc(n + 1, sizeof(long long));
    for (int i = 1; i <= n; i++) {
        int start = jobs[3 * (i - 1) + 1];
        int lo = 0, hi = i - 1;
        while (lo < hi) {
            int mid = (lo + hi) / 2;
            if (jobs[3 * mid] <= start) lo = mid + 1; else hi = mid;
        }
        long long take = dp[lo] + jobs[3 * (i - 1) + 2];
        dp[i] = dp[i - 1] > take ? dp[i - 1] : take;
    }
    int result = (int)dp[n];
    free(jobs); free(dp);
    return result;
}
