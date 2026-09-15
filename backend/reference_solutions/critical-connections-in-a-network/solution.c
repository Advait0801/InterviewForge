static int* ccHead, *ccNext, *ccTo, *ccDisc, *ccLow;
static int ccTimer, ccCount;
static int** ccOut;
static void ccDfs(int u, int parent) {
    ccDisc[u] = ccLow[u] = ccTimer++;
    for (int e = ccHead[u]; e != -1; e = ccNext[e]) {
        int v = ccTo[e];
        if (v == parent) continue;
        if (ccDisc[v] == -1) {
            ccDfs(v, u);
            if (ccLow[v] < ccLow[u]) ccLow[u] = ccLow[v];
            if (ccLow[v] > ccDisc[u]) {
                ccOut[ccCount] = (int*)malloc(2 * sizeof(int));
                ccOut[ccCount][0] = u;
                ccOut[ccCount][1] = v;
                ccCount++;
            }
        } else if (ccDisc[v] < ccLow[u]) {
            ccLow[u] = ccDisc[v];
        }
    }
}
int** criticalConnections(int n, int** connections, int connectionsSize, int* connectionsColSize, int* returnSize, int** returnColumnSizes) {
    ccHead = (int*)malloc(n * sizeof(int));
    ccDisc = (int*)malloc(n * sizeof(int));
    ccLow = (int*)malloc(n * sizeof(int));
    ccNext = (int*)malloc(2 * connectionsSize * sizeof(int));
    ccTo = (int*)malloc(2 * connectionsSize * sizeof(int));
    for (int i = 0; i < n; i++) { ccHead[i] = -1; ccDisc[i] = -1; }
    for (int i = 0; i < connectionsSize; i++) {
        int a = connections[i][0], b = connections[i][1];
        ccTo[2 * i] = b; ccNext[2 * i] = ccHead[a]; ccHead[a] = 2 * i;
        ccTo[2 * i + 1] = a; ccNext[2 * i + 1] = ccHead[b]; ccHead[b] = 2 * i + 1;
    }
    ccOut = (int**)malloc((connectionsSize + 1) * sizeof(int*));
    ccCount = 0;
    ccTimer = 0;
    ccDfs(0, -1);
    *returnColumnSizes = (int*)malloc((ccCount + 1) * sizeof(int));
    for (int i = 0; i < ccCount; i++) (*returnColumnSizes)[i] = 2;
    *returnSize = ccCount;
    free(ccHead); free(ccDisc); free(ccLow); free(ccNext); free(ccTo);
    return ccOut;
}
