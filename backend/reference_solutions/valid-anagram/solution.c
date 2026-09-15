bool isAnagram(char* s, char* t) {
    if (strlen(s) != strlen(t)) return false;
    int counts[26] = {0};
    for (; *s; s++, t++) { counts[*s - 'a']++; counts[*t - 'a']--; }
    for (int i = 0; i < 26; i++) if (counts[i]) return false;
    return true;
}
