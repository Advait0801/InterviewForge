bool canJump(int* nums, int numsSize) {
    long long reach = 0;
    for (int i = 0; i < numsSize; i++) {
        if (i > reach) return false;
        if (i + (long long)nums[i] > reach) reach = i + (long long)nums[i];
    }
    return true;
}
