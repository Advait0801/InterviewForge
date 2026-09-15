class Solution {
public:
    int maxCoins(vector<int>& nums) {
        vector<int> vals(nums.size() + 2, 1);
        for (size_t i = 0; i < nums.size(); i++) vals[i + 1] = nums[i];
        int n = vals.size();
        vector<vector<int>> dp(n, vector<int>(n, 0));
        for (int gap = 2; gap < n; gap++)
            for (int left = 0; left + gap < n; left++) {
                int right = left + gap;
                for (int last = left + 1; last < right; last++)
                    dp[left][right] = max(dp[left][right], vals[left] * vals[last] * vals[right] + dp[left][last] + dp[last][right]);
            }
        return dp[0][n - 1];
    }
};
