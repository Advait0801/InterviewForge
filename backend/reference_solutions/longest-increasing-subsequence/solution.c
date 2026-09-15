int lengthOfLIS(int* nums, int numsSize) {
    int* tails = (int*)malloc(numsSize * sizeof(int));
    int len = 0;
    for (int i = 0; i < numsSize; i++) {
        int lo = 0, hi = len;
        while (lo < hi) {
            int mid = (lo + hi) / 2;
            if (tails[mid] < nums[i]) lo = mid + 1; else hi = mid;
        }
        tails[lo] = nums[i];
        if (lo == len) len++;
    }
    free(tails);
    return len;
}
