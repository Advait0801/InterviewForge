int findTargetSumWays(int* nums, int numsSize, int target) {
    int total = 0;
    for (int i = 0; i < numsSize; i++) total += nums[i];
    if (target > total || target < -total) return 0;
    int width = 2 * total + 1;
    int* ways = (int*)calloc(width, sizeof(int));
    int* next = (int*)malloc(width * sizeof(int));
    ways[total] = 1;
    for (int i = 0; i < numsSize; i++) {
        memset(next, 0, width * sizeof(int));
        for (int s = 0; s < width; s++) {
            if (!ways[s]) continue;
            if (s + nums[i] < width) next[s + nums[i]] += ways[s];
            if (s - nums[i] >= 0) next[s - nums[i]] += ways[s];
        }
        int* t = ways; ways = next; next = t;
    }
    int result = ways[target + total];
    free(ways);
    free(next);
    return result;
}
