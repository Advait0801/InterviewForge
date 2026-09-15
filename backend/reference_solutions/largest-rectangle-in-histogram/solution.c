int largestRectangleArea(int* heights, int heightsSize) {
    int* stStart = (int*)malloc(sizeof(int) * (heightsSize + 1));
    int* stHeight = (int*)malloc(sizeof(int) * (heightsSize + 1));
    int top = 0;
    long long best = 0;
    for (int i = 0; i <= heightsSize; i++) {
        int h = i == heightsSize ? 0 : heights[i];
        int start = i;
        while (top > 0 && stHeight[top - 1] >= h) {
            top--;
            long long area = (long long)stHeight[top] * (i - stStart[top]);
            if (area > best) best = area;
            start = stStart[top];
        }
        stStart[top] = start;
        stHeight[top] = h;
        top++;
    }
    free(stStart); free(stHeight);
    return (int)best;
}
