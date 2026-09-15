class Solution {
public:
    vector<string> letterCombinations(string digits) {
        if (digits.empty()) return {};
        const vector<string> keys = {"", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"};
        vector<string> out = {""};
        for (char d : digits) {
            vector<string> next;
            for (const string& prefix : out)
                for (char ch : keys[d - '0']) next.push_back(prefix + ch);
            out = next;
        }
        return out;
    }
};
