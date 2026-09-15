int longestCommonSubsequence(char* text1, char* text2) {
    int n = (int)strlen(text2);
    int* prev = (int*)calloc(n + 1, sizeof(int));
    int* cur = (int*)calloc(n + 1, sizeof(int));
    for (int i = 0; text1[i]; i++) {
        cur[0] = 0;
        for (int j = 0; j < n; j++) {
            if (text1[i] == text2[j]) cur[j + 1] = prev[j] + 1;
            else cur[j + 1] = prev[j + 1] > cur[j] ? prev[j + 1] : cur[j];
        }
        int* t = prev; prev = cur; cur = t;
    }
    int answer = prev[n];
    free(prev);
    free(cur);
    return answer;
}
