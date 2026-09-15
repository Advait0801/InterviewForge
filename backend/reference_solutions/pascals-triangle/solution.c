int** generate(int numRows, int* returnSize, int** returnColumnSizes) {
    int** rows = (int**)malloc(numRows * sizeof(int*));
    *returnColumnSizes = (int*)malloc(numRows * sizeof(int));
    for (int r = 0; r < numRows; r++) {
        rows[r] = (int*)malloc((r + 1) * sizeof(int));
        (*returnColumnSizes)[r] = r + 1;
        rows[r][0] = rows[r][r] = 1;
        for (int c = 1; c < r; c++) rows[r][c] = rows[r - 1][c - 1] + rows[r - 1][c];
    }
    *returnSize = numRows;
    return rows;
}
