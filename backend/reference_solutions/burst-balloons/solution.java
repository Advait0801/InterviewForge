class Solution {
    public int maxCoins(int[] nums) {
        int n = nums.length + 2;
        int[] vals = new int[n];
        vals[0] = vals[n - 1] = 1;
        for (int i = 0; i < nums.length; i++) vals[i + 1] = nums[i];
        int[][] dp = new int[n][n];
        for (int gap = 2; gap < n; gap++)
            for (int left = 0; left + gap < n; left++) {
                int right = left + gap;
                for (int last = left + 1; last < right; last++)
                    dp[left][right] = Math.max(dp[left][right], vals[left] * vals[last] * vals[right] + dp[left][last] + dp[last][right]);
            }
        return dp[0][n - 1];
    }
}
