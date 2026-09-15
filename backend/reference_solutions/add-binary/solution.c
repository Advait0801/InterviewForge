char* addBinary(char* a, char* b) {
    int i = (int)strlen(a) - 1, j = (int)strlen(b) - 1;
    int len = (i > j ? i : j) + 2;
    char* out = (char*)malloc(len + 1);
    out[len] = '\0';
    int k = len - 1, carry = 0;
    while (i >= 0 || j >= 0 || carry) {
        int total = carry;
        if (i >= 0) total += a[i--] - '0';
        if (j >= 0) total += b[j--] - '0';
        out[k--] = (char)('0' + total % 2);
        carry = total / 2;
    }
    memmove(out, out + k + 1, len - k);
    return out;
}
