static int romanValue(char c) {
    switch (c) {
        case 'I': return 1; case 'V': return 5; case 'X': return 10; case 'L': return 50;
        case 'C': return 100; case 'D': return 500; case 'M': return 1000;
    }
    return 0;
}
int romanToInt(char* s) {
    int total = 0;
    for (int i = 0; s[i]; i++) {
        int v = romanValue(s[i]);
        if (s[i + 1] && v < romanValue(s[i + 1])) total -= v; else total += v;
    }
    return total;
}
