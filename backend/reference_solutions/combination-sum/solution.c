static int** csOut;
static int* csCols;
static int csCount, csCap;
static int csPath[64];

static void csSearch(int* cands, int n, int start, int remain, int depth) {
    if (remain == 0) {
        if (csCount == csCap) {
            csCap *= 2;
            csOut = (int**)realloc(csOut, csCap * sizeof(int*));
            csCols = (int*)realloc(csCols, csCap * sizeof(int));
        }
        csOut[csCount] = (int*)malloc((depth + 1) * sizeof(int));
        memcpy(csOut[csCount], csPath, depth * sizeof(int));
        csCols[csCount++] = depth;
        return;
    }
    for (int i = start; i < n; i++) {
        if (cands[i] <= remain) {
            csPath[depth] = cands[i];
            csSearch(cands, n, i, remain - cands[i], depth + 1);
        }
    }
}

int** combinationSum(int* candidates, int candidatesSize, int target, int* returnSize, int** returnColumnSizes) {
    csCap = 16;
    csCount = 0;
    csOut = (int**)malloc(csCap * sizeof(int*));
    csCols = (int*)malloc(csCap * sizeof(int));
    csSearch(candidates, candidatesSize, 0, target, 0);
    *returnSize = csCount;
    *returnColumnSizes = csCols;
    return csOut;
}
