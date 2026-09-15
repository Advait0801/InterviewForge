static const char* NW_BELOW_20[] = {"", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"};
static const char* NW_TENS[] = {"", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"};

static void nwAppend(char* out, const char* word) {
    if (*out) strcat(out, " ");
    strcat(out, word);
}
static void nwSpell(char* out, int n) {
    if (n >= 100) { nwAppend(out, NW_BELOW_20[n / 100]); nwAppend(out, "Hundred"); n %= 100; }
    if (n >= 20) { nwAppend(out, NW_TENS[n / 10]); n %= 10; }
    if (n > 0) nwAppend(out, NW_BELOW_20[n]);
}
char* numberToWords(int num) {
    char* out = (char*)calloc(512, 1);
    if (num == 0) { strcpy(out, "Zero"); return out; }
    static const int values[] = {1000000000, 1000000, 1000, 1};
    static const char* names[] = {"Billion", "Million", "Thousand", ""};
    for (int i = 0; i < 4; i++) {
        if (num >= values[i]) {
            nwSpell(out, num / values[i]);
            if (*names[i]) nwAppend(out, names[i]);
            num %= values[i];
        }
    }
    return out;
}
