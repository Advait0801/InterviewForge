static int* _ts_vals;
static int _ts_cmp(const void* a, const void* b) {
    int x = _ts_vals[*(const int*)a], y = _ts_vals[*(const int*)b];
    return (x > y) - (x < y);
}

int* twoSum(int* nums, int numsSize, int target, int* returnSize) {
    int* idx = (int*)malloc(sizeof(int) * numsSize);
    for (int i = 0; i < numsSize; i++) idx[i] = i;
    _ts_vals = nums;
    qsort(idx, numsSize, sizeof(int), _ts_cmp);
    int lo = 0, hi = numsSize - 1;
    int* out = (int*)malloc(sizeof(int) * 2);
    *returnSize = 0;
    while (lo < hi) {
        long long sum = (long long)nums[idx[lo]] + nums[idx[hi]];
        if (sum == target) {
            int a = idx[lo], b = idx[hi];
            out[0] = a < b ? a : b;
            out[1] = a < b ? b : a;
            *returnSize = 2;
            break;
        }
        if (sum < target) lo++; else hi--;
    }
    free(idx);
    return out;
}
