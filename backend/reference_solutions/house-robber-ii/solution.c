static int robLine(int* nums, int lo, int hi) {
    int take = 0, skip = 0;
    for (int i = lo; i < hi; i++) {
        int newTake = skip + nums[i];
        skip = take > skip ? take : skip;
        take = newTake;
    }
    return take > skip ? take : skip;
}
int rob(int* nums, int numsSize) {
    if (numsSize == 1) return nums[0];
    int a = robLine(nums, 0, numsSize - 1), b = robLine(nums, 1, numsSize);
    return a > b ? a : b;
}
