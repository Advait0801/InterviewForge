int rob(int* nums, int numsSize) {
    int take = 0, skip = 0;
    for (int i = 0; i < numsSize; i++) {
        int newTake = skip + nums[i];
        skip = take > skip ? take : skip;
        take = newTake;
    }
    return take > skip ? take : skip;
}
