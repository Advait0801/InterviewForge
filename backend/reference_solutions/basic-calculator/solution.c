int calculate(char* s) {
    int len = (int)strlen(s);
    long long* savedTotal = (long long*)malloc((len + 1) * sizeof(long long));
    int* savedSign = (int*)malloc((len + 1) * sizeof(int));
    int top = 0, sign = 1;
    long long total = 0, number = 0;
    for (int i = 0; i < len; i++) {
        char ch = s[i];
        if (ch >= '0' && ch <= '9') number = number * 10 + (ch - '0');
        else if (ch == '+' || ch == '-') { total += sign * number; number = 0; sign = ch == '+' ? 1 : -1; }
        else if (ch == '(') { savedTotal[top] = total; savedSign[top++] = sign; total = 0; sign = 1; }
        else if (ch == ')') {
            total += sign * number;
            top--;
            total = savedTotal[top] + savedSign[top] * total;
            number = 0;
        }
    }
    int result = (int)(total + sign * number);
    free(savedTotal);
    free(savedSign);
    return result;
}
