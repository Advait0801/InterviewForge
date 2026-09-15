int maxCoins(int* nums, int numsSize) {
    int n = numsSize + 2;
    int* vals = (int*)malloc(n * sizeof(int));
    vals[0] = vals[n - 1] = 1;
    for (int i = 0; i < numsSize; i++) vals[i + 1] = nums[i];
    int* dp = (int*)calloc(n * n, sizeof(int));
    for (int gap = 2; gap < n; gap++) {
        for (int left = 0; left + gap < n; left++) {
            int right = left + gap, best = 0;
            for (int last = left + 1; last < right; last++) {
                int coins = vals[left] * vals[last] * vals[right] + dp[left * n + last] + dp[last * n + right];
                if (coins > best) best = coins;
            }
            dp[left * n + right] = best;
        }
    }
    int result = dp[n - 1];
    free(vals);
    free(dp);
    return result;
}
