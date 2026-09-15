class Solution {
public:
    int cherryPickup(vector<vector<int>>& grid) {
        int n = grid.size();
        const int NEG = INT_MIN / 2;
        vector<vector<int>> dp(n, vector<int>(n, NEG));
        dp[0][0] = grid[0][0];
        for (int step = 1; step <= 2 * n - 2; step++) {
            vector<vector<int>> next(n, vector<int>(n, NEG));
            int lo = max(0, step - n + 1), hi = min(n - 1, step);
            for (int r1 = lo; r1 <= hi; r1++) {
                int c1 = step - r1;
                if (grid[r1][c1] == -1) continue;
                for (int r2 = lo; r2 <= hi; r2++) {
                    int c2 = step - r2;
                    if (grid[r2][c2] == -1) continue;
                    int best = dp[r1][r2];
                    if (r1) best = max(best, dp[r1 - 1][r2]);
                    if (r2) best = max(best, dp[r1][r2 - 1]);
                    if (r1 && r2) best = max(best, dp[r1 - 1][r2 - 1]);
                    if (best == NEG) continue;
                    next[r1][r2] = best + grid[r1][c1] + (r1 != r2 ? grid[r2][c2] : 0);
                }
            }
            dp = next;
        }
        return max(0, dp[n - 1][n - 1]);
    }
};
