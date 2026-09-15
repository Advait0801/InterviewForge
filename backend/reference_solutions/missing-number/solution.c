int missingNumber(int* nums, int numsSize) {
    long long total = (long long)numsSize * (numsSize + 1) / 2;
    for (int i = 0; i < numsSize; i++) total -= nums[i];
    return (int)total;
}
