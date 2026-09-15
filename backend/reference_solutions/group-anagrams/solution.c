typedef struct { char* key; int idx; } _AnaEntry;

static int _cmp_char(const void* a, const void* b) {
    return *(const char*)a - *(const char*)b;
}

static int _cmp_entry(const void* a, const void* b) {
    const _AnaEntry* x = (const _AnaEntry*)a;
    const _AnaEntry* y = (const _AnaEntry*)b;
    int c = strcmp(x->key, y->key);
    return c ? c : x->idx - y->idx;
}

char*** groupAnagrams(char** strs, int strsSize, int* returnSize, int** returnColumnSizes) {
    _AnaEntry* entries = (_AnaEntry*)malloc(sizeof(_AnaEntry) * (strsSize ? strsSize : 1));
    for (int i = 0; i < strsSize; i++) {
        int len = strlen(strs[i]);
        entries[i].key = (char*)malloc(len + 1);
        memcpy(entries[i].key, strs[i], len + 1);
        qsort(entries[i].key, len, 1, _cmp_char);
        entries[i].idx = i;
    }
    qsort(entries, strsSize, sizeof(_AnaEntry), _cmp_entry);
    char*** out = (char***)malloc(sizeof(char**) * (strsSize ? strsSize : 1));
    *returnColumnSizes = (int*)malloc(sizeof(int) * (strsSize ? strsSize : 1));
    int groups = 0;
    for (int i = 0; i < strsSize; ) {
        int j = i;
        while (j < strsSize && strcmp(entries[j].key, entries[i].key) == 0) j++;
        out[groups] = (char**)malloc(sizeof(char*) * (j - i));
        for (int k = i; k < j; k++) out[groups][k - i] = strs[entries[k].idx];
        (*returnColumnSizes)[groups] = j - i;
        groups++;
        i = j;
    }
    for (int i = 0; i < strsSize; i++) free(entries[i].key);
    free(entries);
    *returnSize = groups;
    return out;
}
