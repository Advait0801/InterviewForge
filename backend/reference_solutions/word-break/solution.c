bool wordBreak(char* s, char** wordDict, int wordDictSize) {
    int n = strlen(s);
    bool* dp = (bool*)calloc(n + 1, sizeof(bool));
    dp[0] = true;
    for (int end = 1; end <= n; end++) {
        for (int w = 0; w < wordDictSize && !dp[end]; w++) {
            int len = strlen(wordDict[w]);
            if (len <= end && dp[end - len] && strncmp(s + end - len, wordDict[w], len) == 0) dp[end] = true;
        }
    }
    bool result = dp[n];
    free(dp);
    return result;
}
