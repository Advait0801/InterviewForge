int countSubstrings(char* s) {
    int n = (int)strlen(s), count = 0;
    for (int center = 0; center < 2 * n - 1; center++) {
        int left = center / 2, right = left + center % 2;
        while (left >= 0 && right < n && s[left] == s[right]) { count++; left--; right++; }
    }
    return count;
}
