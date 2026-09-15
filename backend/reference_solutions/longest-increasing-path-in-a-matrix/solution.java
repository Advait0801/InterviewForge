class Solution {
    private int[][] memo;
    private int longest(int[][] mat, int r, int c) {
        if (memo[r][c] != 0) return memo[r][c];
        int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
        int best = 1;
        for (int[] d : dirs) {
            int nr = r + d[0], nc = c + d[1];
            if (nr >= 0 && nr < mat.length && nc >= 0 && nc < mat[0].length && mat[nr][nc] > mat[r][c])
                best = Math.max(best, 1 + longest(mat, nr, nc));
        }
        return memo[r][c] = best;
    }
    public int longestIncreasingPath(int[][] matrix) {
        memo = new int[matrix.length][matrix[0].length];
        int best = 0;
        for (int r = 0; r < matrix.length; r++)
            for (int c = 0; c < matrix[0].length; c++) best = Math.max(best, longest(matrix, r, c));
        return best;
    }
}
