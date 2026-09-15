class Solution {
public:
    int numDistinct(string s, string t) {
        vector<unsigned long long> dp(t.size() + 1, 0);
        dp[0] = 1;
        for (char ch : s)
            for (int j = t.size(); j >= 1; j--)
                if (t[j - 1] == ch) dp[j] += dp[j - 1];
        return (int)dp[t.size()];
    }
};
