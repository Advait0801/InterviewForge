int minCut(char* s) {
    int n = (int)strlen(s);
    int* cuts = (int*)malloc((n + 1) * sizeof(int));
    for (int i = 0; i <= n; i++) cuts[i] = i - 1;
    for (int center = 0; center < n; center++) {
        for (int odd = 0; odd <= 1; odd++) {
            int left = center, right = center + odd;
            while (left >= 0 && right < n && s[left] == s[right]) {
                if (cuts[left] + 1 < cuts[right + 1]) cuts[right + 1] = cuts[left] + 1;
                left--;
                right++;
            }
        }
    }
    int result = cuts[n];
    free(cuts);
    return result;
}
