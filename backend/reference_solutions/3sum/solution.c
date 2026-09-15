static int _cmp_int(const void* a, const void* b) {
    int x = *(const int*)a, y = *(const int*)b;
    return (x > y) - (x < y);
}

int** threeSum(int* nums, int numsSize, int* returnSize, int** returnColumnSizes) {
    qsort(nums, numsSize, sizeof(int), _cmp_int);
    int cap = 16, count = 0;
    int** out = (int**)malloc(sizeof(int*) * cap);
    for (int i = 0; i + 2 < numsSize; i++) {
        if (i > 0 && nums[i] == nums[i - 1]) continue;
        int lo = i + 1, hi = numsSize - 1;
        while (lo < hi) {
            long long sum = (long long)nums[i] + nums[lo] + nums[hi];
            if (sum < 0) lo++;
            else if (sum > 0) hi--;
            else {
                if (count == cap) { cap *= 2; out = (int**)realloc(out, sizeof(int*) * cap); }
                out[count] = (int*)malloc(sizeof(int) * 3);
                out[count][0] = nums[i]; out[count][1] = nums[lo]; out[count][2] = nums[hi];
                count++;
                while (lo < hi && nums[lo] == nums[lo + 1]) lo++;
                while (lo < hi && nums[hi] == nums[hi - 1]) hi--;
                lo++; hi--;
            }
        }
    }
    *returnSize = count;
    *returnColumnSizes = (int*)malloc(sizeof(int) * (count ? count : 1));
    for (int i = 0; i < count; i++) (*returnColumnSizes)[i] = 3;
    return out;
}
