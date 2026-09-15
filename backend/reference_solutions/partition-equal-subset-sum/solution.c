bool canPartition(int* nums, int numsSize) {
    int total = 0;
    for (int i = 0; i < numsSize; i++) total += nums[i];
    if (total % 2) return false;
    int half = total / 2;
    bool* reachable = (bool*)calloc(half + 1, sizeof(bool));
    reachable[0] = true;
    for (int i = 0; i < numsSize; i++)
        for (int s = half; s >= nums[i]; s--)
            if (reachable[s - nums[i]]) reachable[s] = true;
    bool answer = reachable[half];
    free(reachable);
    return answer;
}
