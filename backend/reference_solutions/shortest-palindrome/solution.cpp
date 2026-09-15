class Solution {
public:
    string shortestPalindrome(string s) {
        string reversed(s.rbegin(), s.rend());
        string combined = s + "#" + reversed;
        vector<int> fail(combined.size(), 0);
        for (size_t i = 1; i < combined.size(); i++) {
            int k = fail[i - 1];
            while (k && combined[i] != combined[k]) k = fail[k - 1];
            if (combined[i] == combined[k]) k++;
            fail[i] = k;
        }
        return reversed.substr(0, s.size() - fail.back()) + s;
    }
};
