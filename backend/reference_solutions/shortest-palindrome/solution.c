char* shortestPalindrome(char* s) {
    int n = (int)strlen(s), total = 2 * n + 1;
    char* combined = (char*)malloc(total + 1);
    memcpy(combined, s, n);
    combined[n] = '#';
    for (int i = 0; i < n; i++) combined[n + 1 + i] = s[n - 1 - i];
    combined[total] = '\0';
    int* fail = (int*)calloc(total, sizeof(int));
    for (int i = 1; i < total; i++) {
        int k = fail[i - 1];
        while (k && combined[i] != combined[k]) k = fail[k - 1];
        if (combined[i] == combined[k]) k++;
        fail[i] = k;
    }
    int extra = n - fail[total - 1];
    char* out = (char*)malloc(extra + n + 1);
    for (int i = 0; i < extra; i++) out[i] = s[n - 1 - i];
    memcpy(out + extra, s, n);
    out[extra + n] = '\0';
    free(combined);
    free(fail);
    return out;
}
