static void fillFrom(int** image, int rows, int* cols, int r, int c, int from, int to) {
    if (r < 0 || r >= rows || c < 0 || c >= cols[r] || image[r][c] != from) return;
    image[r][c] = to;
    fillFrom(image, rows, cols, r + 1, c, from, to);
    fillFrom(image, rows, cols, r - 1, c, from, to);
    fillFrom(image, rows, cols, r, c + 1, from, to);
    fillFrom(image, rows, cols, r, c - 1, from, to);
}
int** floodFill(int** image, int imageSize, int* imageColSize, int sr, int sc, int color, int* returnSize, int** returnColumnSizes) {
    int from = image[sr][sc];
    if (from != color) fillFrom(image, imageSize, imageColSize, sr, sc, from, color);
    *returnSize = imageSize;
    *returnColumnSizes = (int*)malloc(imageSize * sizeof(int));
    for (int r = 0; r < imageSize; r++) (*returnColumnSizes)[r] = imageColSize[r];
    return image;
}
