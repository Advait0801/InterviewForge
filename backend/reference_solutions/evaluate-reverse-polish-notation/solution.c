int evalRPN(char** tokens, int tokensSize) {
    long long* stack = (long long*)malloc(tokensSize * sizeof(long long));
    int top = 0;
    for (int i = 0; i < tokensSize; i++) {
        char* t = tokens[i];
        if (t[1] == '\0' && (t[0] == '+' || t[0] == '-' || t[0] == '*' || t[0] == '/')) {
            long long b = stack[--top], a = stack[--top];
            switch (t[0]) {
                case '+': a += b; break;
                case '-': a -= b; break;
                case '*': a *= b; break;
                default: a /= b;
            }
            stack[top++] = a;
        } else {
            stack[top++] = atoll(t);
        }
    }
    int result = (int)stack[0];
    free(stack);
    return result;
}
