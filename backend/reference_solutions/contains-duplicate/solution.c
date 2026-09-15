static int _cmp_int(const void* a, const void* b) {
    int x = *(const int*)a, y = *(const int*)b;
    return (x > y) - (x < y);
}

bool containsDuplicate(int* nums, int numsSize) {
    qsort(nums, numsSize, sizeof(int), _cmp_int);
    for (int i = 1; i < numsSize; i++) if (nums[i] == nums[i - 1]) return true;
    return false;
}
