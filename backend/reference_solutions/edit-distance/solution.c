int minDistance(char* word1, char* word2) {
    int m = strlen(word1), n = strlen(word2);
    int* prev = (int*)malloc(sizeof(int) * (n + 1));
    int* cur = (int*)malloc(sizeof(int) * (n + 1));
    for (int j = 0; j <= n; j++) prev[j] = j;
    for (int i = 1; i <= m; i++) {
        cur[0] = i;
        for (int j = 1; j <= n; j++) {
            if (word1[i - 1] == word2[j - 1]) cur[j] = prev[j - 1];
            else {
                int best = prev[j] < cur[j - 1] ? prev[j] : cur[j - 1];
                if (prev[j - 1] < best) best = prev[j - 1];
                cur[j] = best + 1;
            }
        }
        int* t = prev; prev = cur; cur = t;
    }
    int result = prev[n];
    free(prev); free(cur);
    return result;
}
