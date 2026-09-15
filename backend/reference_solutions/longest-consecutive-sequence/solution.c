static int cmpInt(const void* a, const void* b) {
    int x = *(const int*)a, y = *(const int*)b;
    return (x > y) - (x < y);
}
int longestConsecutive(int* nums, int numsSize) {
    if (numsSize == 0) return 0;
    qsort(nums, numsSize, sizeof(int), cmpInt);
    int best = 1, run = 1;
    for (int i = 1; i < numsSize; i++) {
        if (nums[i] == nums[i - 1]) continue;
        run = ((long long)nums[i] == (long long)nums[i - 1] + 1) ? run + 1 : 1;
        if (run > best) best = run;
    }
    return best;
}
