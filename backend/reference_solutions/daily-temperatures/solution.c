int* dailyTemperatures(int* temperatures, int temperaturesSize, int* returnSize) {
    int* answer = (int*)calloc(temperaturesSize, sizeof(int));
    int* stack = (int*)malloc(temperaturesSize * sizeof(int));
    int top = 0;
    for (int i = 0; i < temperaturesSize; i++) {
        while (top && temperatures[stack[top - 1]] < temperatures[i]) {
            int j = stack[--top];
            answer[j] = i - j;
        }
        stack[top++] = i;
    }
    free(stack);
    *returnSize = temperaturesSize;
    return answer;
}
