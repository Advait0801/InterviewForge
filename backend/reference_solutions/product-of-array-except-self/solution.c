int* productExceptSelf(int* nums, int numsSize, int* returnSize) {
    int* out = (int*)malloc(sizeof(int) * numsSize);
    int prefix = 1;
    for (int i = 0; i < numsSize; i++) { out[i] = prefix; prefix *= nums[i]; }
    int suffix = 1;
    for (int i = numsSize - 1; i >= 0; i--) { out[i] *= suffix; suffix *= nums[i]; }
    *returnSize = numsSize;
    return out;
}
