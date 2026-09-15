int longestValidParentheses(char* s) {
    int n = strlen(s), top = 0, best = 0;
    int* st = (int*)malloc(sizeof(int) * (n + 1));
    st[top++] = -1;
    for (int i = 0; i < n; i++) {
        if (s[i] == '(') { st[top++] = i; continue; }
        top--;
        if (top == 0) st[top++] = i;
        else if (i - st[top - 1] > best) best = i - st[top - 1];
    }
    free(st);
    return best;
}
