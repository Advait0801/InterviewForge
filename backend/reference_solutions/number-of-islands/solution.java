class Solution {
    public int numIslands(char[][] grid) {
        if (grid.length == 0) return 0;
        int rows = grid.length, cols = grid[0].length, count = 0;
        int[] dr = {1, -1, 0, 0}, dc = {0, 0, 1, -1};
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (grid[r][c] != '1') continue;
                count++;
                Deque<int[]> st = new ArrayDeque<>();
                st.push(new int[]{r, c});
                grid[r][c] = '0';
                while (!st.isEmpty()) {
                    int[] cell = st.pop();
                    for (int d = 0; d < 4; d++) {
                        int nr = cell[0] + dr[d], nc = cell[1] + dc[d];
                        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] == '1') {
                            grid[nr][nc] = '0';
                            st.push(new int[]{nr, nc});
                        }
                    }
                }
            }
        }
        return count;
    }
}
