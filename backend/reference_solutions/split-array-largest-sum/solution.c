int splitArray(int* nums, int numsSize, int k) {
    long long lo = 0, hi = 0;
    for (int i = 0; i < numsSize; i++) { if (nums[i] > lo) lo = nums[i]; hi += nums[i]; }
    while (lo < hi) {
        long long mid = (lo + hi) / 2, current = 0;
        int pieces = 1;
        for (int i = 0; i < numsSize; i++) {
            if (current + nums[i] > mid) { pieces++; current = 0; }
            current += nums[i];
        }
        if (pieces <= k) hi = mid; else lo = mid + 1;
    }
    return (int)lo;
}
