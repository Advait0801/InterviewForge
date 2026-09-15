char** letterCombinations(char* digits, int* returnSize) {
    static const char* keys[10] = {"", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"};
    int n = (int)strlen(digits);
    if (n == 0) { *returnSize = 0; return (char**)malloc(sizeof(char*)); }
    int total = 1;
    for (int i = 0; i < n; i++) total *= (int)strlen(keys[digits[i] - '0']);
    char** out = (char**)malloc(total * sizeof(char*));
    for (int k = 0; k < total; k++) {
        out[k] = (char*)malloc(n + 1);
        int rem = k;
        for (int i = n - 1; i >= 0; i--) {
            const char* letters = keys[digits[i] - '0'];
            int len = (int)strlen(letters);
            out[k][i] = letters[rem % len];
            rem /= len;
        }
        out[k][n] = '\0';
    }
    *returnSize = total;
    return out;
}
