int singleNumber(int* nums, int numsSize) {
    int acc = 0;
    for (int i = 0; i < numsSize; i++) acc ^= nums[i];
    return acc;
}
