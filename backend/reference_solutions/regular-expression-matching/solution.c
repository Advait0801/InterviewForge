bool isMatch(char* s, char* p) {
    int m = (int)strlen(s), n = (int)strlen(p), w = n + 1;
    bool* dp = (bool*)calloc((m + 1) * w, sizeof(bool));
    dp[m * w + n] = true;
    for (int i = m; i >= 0; i--) {
        for (int j = n - 1; j >= 0; j--) {
            bool first = i < m && (p[j] == s[i] || p[j] == '.');
            if (j + 1 < n && p[j + 1] == '*') dp[i * w + j] = dp[i * w + j + 2] || (first && dp[(i + 1) * w + j]);
            else dp[i * w + j] = first && dp[(i + 1) * w + j + 1];
        }
    }
    bool result = dp[0];
    free(dp);
    return result;
}
