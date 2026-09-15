int** subsets(int* nums, int numsSize, int* returnSize, int** returnColumnSizes) {
    int total = 1 << numsSize;
    int** out = (int**)malloc(total * sizeof(int*));
    *returnColumnSizes = (int*)malloc(total * sizeof(int));
    for (int mask = 0; mask < total; mask++) {
        int k = 0;
        out[mask] = (int*)malloc((numsSize + 1) * sizeof(int));
        for (int i = 0; i < numsSize; i++) if ((mask >> i) & 1) out[mask][k++] = nums[i];
        (*returnColumnSizes)[mask] = k;
    }
    *returnSize = total;
    return out;
}
