class Solution {
public:
    bool wordBreak(string s, vector<string>& wordDict) {
        unordered_set<string> words(wordDict.begin(), wordDict.end());
        int n = s.size();
        vector<bool> dp(n + 1, false);
        dp[0] = true;
        for (int end = 1; end <= n; end++)
            for (int start = 0; start < end; start++)
                if (dp[start] && words.count(s.substr(start, end - start))) { dp[end] = true; break; }
        return dp[n];
    }
};
