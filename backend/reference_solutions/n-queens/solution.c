static void _place(int row, int n, int* cols, bool* usedCol, bool* diag, bool* anti,
                   char**** out, int* count, int* cap) {
    if (row == n) {
        if (*count == *cap) { *cap *= 2; *out = (char***)realloc(*out, sizeof(char**) * (*cap)); }
        char** board = (char**)malloc(sizeof(char*) * n);
        for (int r = 0; r < n; r++) {
            board[r] = (char*)malloc(n + 1);
            memset(board[r], '.', n);
            board[r][cols[r]] = 'Q';
            board[r][n] = '\0';
        }
        (*out)[(*count)++] = board;
        return;
    }
    for (int c = 0; c < n; c++) {
        if (usedCol[c] || diag[row - c + n - 1] || anti[row + c]) continue;
        cols[row] = c;
        usedCol[c] = diag[row - c + n - 1] = anti[row + c] = true;
        _place(row + 1, n, cols, usedCol, diag, anti, out, count, cap);
        usedCol[c] = diag[row - c + n - 1] = anti[row + c] = false;
    }
}

char*** solveNQueens(int n, int* returnSize, int** returnColumnSizes) {
    int cap = 8, count = 0;
    char*** out = (char***)malloc(sizeof(char**) * cap);
    int* cols = (int*)calloc(n, sizeof(int));
    bool* usedCol = (bool*)calloc(n, sizeof(bool));
    bool* diag = (bool*)calloc(2 * n, sizeof(bool));
    bool* anti = (bool*)calloc(2 * n, sizeof(bool));
    _place(0, n, cols, usedCol, diag, anti, &out, &count, &cap);
    *returnSize = count;
    *returnColumnSizes = (int*)malloc(sizeof(int) * (count ? count : 1));
    for (int i = 0; i < count; i++) (*returnColumnSizes)[i] = n;
    free(cols); free(usedCol); free(diag); free(anti);
    return out;
}
