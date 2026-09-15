int findKthLargest(int* nums, int numsSize, int k) {
    /* Counting sort over the value range [-10^4, 10^4]. */
    int* counts = (int*)calloc(20001, sizeof(int));
    for (int i = 0; i < numsSize; i++) counts[nums[i] + 10000]++;
    int answer = 0;
    for (int v = 20000; v >= 0; v--) {
        k -= counts[v];
        if (k <= 0) { answer = v - 10000; break; }
    }
    free(counts);
    return answer;
}
