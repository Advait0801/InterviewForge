int numDecodings(char* s) {
    long long prev2 = 0, prev1 = 1;
    for (int i = 0; s[i]; i++) {
        long long cur = s[i] != '0' ? prev1 : 0;
        if (i > 0 && (s[i - 1] == '1' || (s[i - 1] == '2' && s[i] <= '6'))) cur += prev2;
        prev2 = prev1;
        prev1 = cur;
    }
    return (int)prev1;
}
