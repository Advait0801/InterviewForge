char* minWindow(char* s, char* t) {
    int need[128] = {0};
    int n = strlen(s), m = strlen(t);
    for (int i = 0; i < m; i++) need[(unsigned char)t[i]]++;
    int missing = m, start = 0, bestStart = 0, bestLen = n + 1;
    for (int end = 0; end < n; end++) {
        if (need[(unsigned char)s[end]]-- > 0) missing--;
        while (missing == 0) {
            if (end - start + 1 < bestLen) { bestStart = start; bestLen = end - start + 1; }
            if (++need[(unsigned char)s[start++]] > 0) missing++;
        }
    }
    if (m == 0 || bestLen > n) {
        char* empty = (char*)malloc(1);
        empty[0] = '\0';
        return empty;
    }
    char* out = (char*)malloc(bestLen + 1);
    memcpy(out, s + bestStart, bestLen);
    out[bestLen] = '\0';
    return out;
}
