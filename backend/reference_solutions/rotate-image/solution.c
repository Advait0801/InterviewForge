void rotate(int** matrix, int matrixSize, int* matrixColSize) {
    int n = matrixSize;
    for (int i = 0; i < n; i++)
        for (int j = i + 1; j < n; j++) {
            int t = matrix[i][j]; matrix[i][j] = matrix[j][i]; matrix[j][i] = t;
        }
    for (int r = 0; r < n; r++)
        for (int i = 0, j = n - 1; i < j; i++, j--) {
            int t = matrix[r][i]; matrix[r][i] = matrix[r][j]; matrix[r][j] = t;
        }
}
