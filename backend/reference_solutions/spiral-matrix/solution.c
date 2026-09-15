int* spiralOrder(int** matrix, int matrixSize, int* matrixColSize, int* returnSize) {
    int m = matrixSize, n = matrixColSize[0], k = 0;
    int* out = (int*)malloc(m * n * sizeof(int));
    int top = 0, bottom = m - 1, left = 0, right = n - 1;
    while (top <= bottom && left <= right) {
        for (int c = left; c <= right; c++) out[k++] = matrix[top][c];
        top++;
        for (int r = top; r <= bottom; r++) out[k++] = matrix[r][right];
        right--;
        if (top <= bottom) { for (int c = right; c >= left; c--) out[k++] = matrix[bottom][c]; bottom--; }
        if (left <= right) { for (int r = bottom; r >= top; r--) out[k++] = matrix[r][left]; left++; }
    }
    *returnSize = k;
    return out;
}
