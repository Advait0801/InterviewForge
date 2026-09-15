class Solution {
public:
    bool isSubsequence(string s, string t) {
        size_t i = 0;
        for (char ch : t) if (i < s.size() && s[i] == ch) i++;
        return i == s.size();
    }
};
