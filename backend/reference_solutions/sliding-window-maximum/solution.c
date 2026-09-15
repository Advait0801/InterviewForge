int* maxSlidingWindow(int* nums, int numsSize, int k, int* returnSize) {
    int* out = (int*)malloc((numsSize - k + 1) * sizeof(int));
    int* window = (int*)malloc(numsSize * sizeof(int));
    int head = 0, tail = 0, count = 0;
    for (int i = 0; i < numsSize; i++) {
        while (tail > head && nums[window[tail - 1]] <= nums[i]) tail--;
        window[tail++] = i;
        if (window[head] <= i - k) head++;
        if (i >= k - 1) out[count++] = nums[window[head]];
    }
    free(window);
    *returnSize = count;
    return out;
}
