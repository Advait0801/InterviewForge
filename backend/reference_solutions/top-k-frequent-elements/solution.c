static int _cmp_int(const void* a, const void* b) {
    int x = *(const int*)a, y = *(const int*)b;
    return (x > y) - (x < y);
}

static int _cmp_pair(const void* a, const void* b) {
    const int* p = (const int*)a;
    const int* q = (const int*)b;
    if (p[1] != q[1]) return q[1] - p[1];      /* frequency, descending */
    return (p[0] > q[0]) - (p[0] < q[0]);      /* value, ascending */
}

int* topKFrequent(int* nums, int numsSize, int k, int* returnSize) {
    int* sorted = (int*)malloc(sizeof(int) * numsSize);
    memcpy(sorted, nums, sizeof(int) * numsSize);
    qsort(sorted, numsSize, sizeof(int), _cmp_int);
    int* pairs = (int*)malloc(sizeof(int) * 2 * numsSize);
    int distinct = 0;
    for (int i = 0; i < numsSize; ) {
        int j = i;
        while (j < numsSize && sorted[j] == sorted[i]) j++;
        pairs[2 * distinct] = sorted[i];
        pairs[2 * distinct + 1] = j - i;
        distinct++;
        i = j;
    }
    qsort(pairs, distinct, sizeof(int) * 2, _cmp_pair);
    int take = k < distinct ? k : distinct;
    int* out = (int*)malloc(sizeof(int) * (take ? take : 1));
    for (int i = 0; i < take; i++) out[i] = pairs[2 * i];
    *returnSize = take;
    free(sorted); free(pairs);
    return out;
}
