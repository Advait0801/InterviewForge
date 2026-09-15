class Solution {
    public int uniquePaths(int m, int n) {
        long[] row = new long[n];
        java.util.Arrays.fill(row, 1);
        for (int r = 1; r < m; r++)
            for (int c = 1; c < n; c++) row[c] += row[c - 1];
        return (int) row[n - 1];
    }
}
