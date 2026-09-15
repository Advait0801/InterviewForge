void setZeroes(int** matrix, int matrixSize, int* matrixColSize) {
    int m = matrixSize, n = matrixColSize[0];
    bool* zeroRow = (bool*)calloc(m, sizeof(bool));
    bool* zeroCol = (bool*)calloc(n, sizeof(bool));
    for (int r = 0; r < m; r++)
        for (int c = 0; c < n; c++)
            if (matrix[r][c] == 0) { zeroRow[r] = true; zeroCol[c] = true; }
    for (int r = 0; r < m; r++)
        for (int c = 0; c < n; c++)
            if (zeroRow[r] || zeroCol[c]) matrix[r][c] = 0;
    free(zeroRow);
    free(zeroCol);
}
