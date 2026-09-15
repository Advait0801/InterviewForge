class Solution {
    const vector<string> below20 = {"", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
        "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"};
    const vector<string> tens = {"", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"};
    void spell(int n, vector<string>& words) {
        if (n >= 100) { words.push_back(below20[n / 100]); words.push_back("Hundred"); n %= 100; }
        if (n >= 20) { words.push_back(tens[n / 10]); n %= 10; }
        if (n > 0) words.push_back(below20[n]);
    }
public:
    string numberToWords(int num) {
        if (num == 0) return "Zero";
        vector<string> words;
        int values[] = {1000000000, 1000000, 1000, 1};
        const char* names[] = {"Billion", "Million", "Thousand", ""};
        for (int i = 0; i < 4; i++) {
            if (num >= values[i]) {
                spell(num / values[i], words);
                if (*names[i]) words.push_back(names[i]);
                num %= values[i];
            }
        }
        string out;
        for (size_t i = 0; i < words.size(); i++) out += (i ? " " : "") + words[i];
        return out;
    }
};
