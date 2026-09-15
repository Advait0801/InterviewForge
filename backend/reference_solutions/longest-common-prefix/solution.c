char* longestCommonPrefix(char** strs, int strsSize) {
    int len = (int)strlen(strs[0]);
    for (int i = 1; i < strsSize; i++) {
        int j = 0;
        while (j < len && strs[i][j] && strs[i][j] == strs[0][j]) j++;
        len = j;
    }
    char* out = (char*)malloc(len + 1);
    memcpy(out, strs[0], len);
    out[len] = '\0';
    return out;
}
