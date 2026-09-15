class Solution {
    public int cherryPickup(int[][] grid) {
        int n = grid.length;
        final int NEG = Integer.MIN_VALUE / 2;
        int[][] dp = new int[n][n];
        for (int[] row : dp) Arrays.fill(row, NEG);
        dp[0][0] = grid[0][0];
        for (int step = 1; step <= 2 * n - 2; step++) {
            int[][] next = new int[n][n];
            for (int[] row : next) Arrays.fill(row, NEG);
            int lo = Math.max(0, step - n + 1), hi = Math.min(n - 1, step);
            for (int r1 = lo; r1 <= hi; r1++) {
                int c1 = step - r1;
                if (grid[r1][c1] == -1) continue;
                for (int r2 = lo; r2 <= hi; r2++) {
                    int c2 = step - r2;
                    if (grid[r2][c2] == -1) continue;
                    int best = dp[r1][r2];
                    if (r1 > 0) best = Math.max(best, dp[r1 - 1][r2]);
                    if (r2 > 0) best = Math.max(best, dp[r1][r2 - 1]);
                    if (r1 > 0 && r2 > 0) best = Math.max(best, dp[r1 - 1][r2 - 1]);
                    if (best == NEG) continue;
                    next[r1][r2] = best + grid[r1][c1] + (r1 != r2 ? grid[r2][c2] : 0);
                }
            }
            dp = next;
        }
        return Math.max(0, dp[n - 1][n - 1]);
    }
}
