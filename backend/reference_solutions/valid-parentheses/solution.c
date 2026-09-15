bool isValid(char* s) {
    int n = strlen(s), top = 0;
    char* st = (char*)malloc(n + 1);
    for (int i = 0; i < n; i++) {
        char c = s[i];
        if (c == '(' || c == '[' || c == '{') { st[top++] = c; continue; }
        if (top == 0) { free(st); return false; }
        char open = st[--top];
        if ((c == ')' && open != '(') || (c == ']' && open != '[') || (c == '}' && open != '{')) { free(st); return false; }
    }
    free(st);
    return top == 0;
}
