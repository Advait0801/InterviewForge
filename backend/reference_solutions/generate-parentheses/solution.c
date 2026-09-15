static void parenBuild(char** out, int* count, char* buf, int pos, int opened, int closed, int n) {
    if (pos == 2 * n) {
        out[*count] = (char*)malloc(2 * n + 1);
        memcpy(out[*count], buf, 2 * n);
        out[*count][2 * n] = '\0';
        (*count)++;
        return;
    }
    if (opened < n) { buf[pos] = '('; parenBuild(out, count, buf, pos + 1, opened + 1, closed, n); }
    if (closed < opened) { buf[pos] = ')'; parenBuild(out, count, buf, pos + 1, opened, closed + 1, n); }
}
char** generateParenthesis(int n, int* returnSize) {
    char** out = (char**)malloc(1430 * sizeof(char*));  /* Catalan(8) = 1430 */
    char buf[17];
    int count = 0;
    parenBuild(out, &count, buf, 0, 0, 0, n);
    *returnSize = count;
    return out;
}
