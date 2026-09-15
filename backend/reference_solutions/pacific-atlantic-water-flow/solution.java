class Solution {
    private void climb(int[][] h, int r, int c, boolean[][] seen) {
        seen[r][c] = true;
        int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
        for (int[] d : dirs) {
            int nr = r + d[0], nc = c + d[1];
            if (nr >= 0 && nr < h.length && nc >= 0 && nc < h[0].length && !seen[nr][nc] && h[nr][nc] >= h[r][c])
                climb(h, nr, nc, seen);
        }
    }
    public List<List<Integer>> pacificAtlantic(int[][] heights) {
        int m = heights.length, n = heights[0].length;
        boolean[][] pacific = new boolean[m][n], atlantic = new boolean[m][n];
        for (int r = 0; r < m; r++) {
            if (!pacific[r][0]) climb(heights, r, 0, pacific);
            if (!atlantic[r][n - 1]) climb(heights, r, n - 1, atlantic);
        }
        for (int c = 0; c < n; c++) {
            if (!pacific[0][c]) climb(heights, 0, c, pacific);
            if (!atlantic[m - 1][c]) climb(heights, m - 1, c, atlantic);
        }
        List<List<Integer>> out = new ArrayList<>();
        for (int r = 0; r < m; r++)
            for (int c = 0; c < n; c++)
                if (pacific[r][c] && atlantic[r][c]) out.add(Arrays.asList(r, c));
        return out;
    }
}
