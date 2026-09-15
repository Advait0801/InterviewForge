int* countSmaller(int* nums, int numsSize, int* returnSize) {
    const int offset = 10001, size = 20002;
    int* tree = (int*)calloc(size + 1, sizeof(int));
    int* out = (int*)malloc(numsSize * sizeof(int));
    for (int i = numsSize - 1; i >= 0; i--) {
        int idx = nums[i] + offset, total = 0;
        for (int q = idx - 1; q > 0; q -= q & -q) total += tree[q];
        out[i] = total;
        for (; idx <= size; idx += idx & -idx) tree[idx]++;
    }
    free(tree);
    *returnSize = numsSize;
    return out;
}
