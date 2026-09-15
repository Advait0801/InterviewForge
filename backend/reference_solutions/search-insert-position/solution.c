int searchInsert(int* nums, int numsSize, int target) {
    int lo = 0, hi = numsSize;
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (nums[mid] < target) lo = mid + 1; else hi = mid;
    }
    return lo;
}
