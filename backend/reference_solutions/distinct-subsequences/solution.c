int numDistinct(char* s, char* t) {
    int n = (int)strlen(t);
    unsigned long long* dp = (unsigned long long*)calloc(n + 1, sizeof(unsigned long long));
    dp[0] = 1;
    for (; *s; s++)
        for (int j = n; j >= 1; j--)
            if (t[j - 1] == *s) dp[j] += dp[j - 1];
    int result = (int)dp[n];
    free(dp);
    return result;
}
