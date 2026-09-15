int* plusOne(int* digits, int digitsSize, int* returnSize) {
    int* out = (int*)malloc((digitsSize + 1) * sizeof(int));
    int carry = 1;
    for (int i = digitsSize - 1; i >= 0; i--) {
        int d = digits[i] + carry;
        out[i + 1] = d % 10;
        carry = d / 10;
    }
    out[0] = carry;
    if (carry) { *returnSize = digitsSize + 1; return out; }
    memmove(out, out + 1, digitsSize * sizeof(int));
    *returnSize = digitsSize;
    return out;
}
