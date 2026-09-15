static int sumSlot(long long* keys, bool* used, int cap, long long key) {
    unsigned long long h = (unsigned long long)key * 11400714819323198485ULL;
    int i = (int)((h >> 40) & (unsigned long long)(cap - 1));
    while (used[i] && keys[i] != key) i = (i + 1) & (cap - 1);
    return i;
}
int subarraySum(int* nums, int numsSize, int k) {
    int cap = 1;
    while (cap < 2 * (numsSize + 1)) cap <<= 1;
    long long* keys = (long long*)malloc(cap * sizeof(long long));
    int* counts = (int*)calloc(cap, sizeof(int));
    bool* used = (bool*)calloc(cap, sizeof(bool));
    int slot = sumSlot(keys, used, cap, 0);
    used[slot] = true; keys[slot] = 0; counts[slot] = 1;
    long long total = 0;
    int result = 0;
    for (int i = 0; i < numsSize; i++) {
        total += nums[i];
        int want = sumSlot(keys, used, cap, total - k);
        if (used[want]) result += counts[want];
        int own = sumSlot(keys, used, cap, total);
        if (!used[own]) { used[own] = true; keys[own] = total; }
        counts[own]++;
    }
    free(keys);
    free(counts);
    free(used);
    return result;
}
