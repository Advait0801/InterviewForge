bool isSubsequence(char* s, char* t) {
    for (; *t; t++) if (*s && *s == *t) s++;
    return *s == '\0';
}
