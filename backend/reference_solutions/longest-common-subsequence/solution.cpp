class Solution {
public:
    int longestCommonSubsequence(string text1, string text2) {
        int n = text2.size();
        vector<int> prev(n + 1, 0), cur(n + 1, 0);
        for (char a : text1) {
            for (int j = 0; j < n; j++)
                cur[j + 1] = a == text2[j] ? prev[j] + 1 : max(prev[j + 1], cur[j]);
            swap(prev, cur);
        }
        return prev[n];
    }
};
