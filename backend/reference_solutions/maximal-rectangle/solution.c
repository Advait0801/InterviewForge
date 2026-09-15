int maximalRectangle(char** matrix, int matrixSize, int* matrixColSize) {
    int n = matrixColSize[0], best = 0;
    int* heights = (int*)calloc(n + 1, sizeof(int));
    int* stack = (int*)malloc((n + 2) * sizeof(int));
    for (int r = 0; r < matrixSize; r++) {
        for (int c = 0; c < n; c++) heights[c] = matrix[r][c] == '1' ? heights[c] + 1 : 0;
        int top = 0;
        stack[top++] = -1;
        for (int c = 0; c <= n; c++) {
            while (stack[top - 1] != -1 && heights[stack[top - 1]] >= heights[c]) {
                int h = heights[stack[--top]];
                int width = c - stack[top - 1] - 1;
                if (h * width > best) best = h * width;
            }
            stack[top++] = c;
        }
    }
    free(heights);
    free(stack);
    return best;
}
