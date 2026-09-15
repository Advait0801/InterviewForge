class Solution {
    public int swimInWater(int[][] grid) {
        int n = grid.length;
        PriorityQueue<int[]> heap = new PriorityQueue<>((a, b) -> Integer.compare(a[0], b[0]));
        boolean[][] seen = new boolean[n][n];
        heap.add(new int[]{grid[0][0], 0, 0});
        seen[0][0] = true;
        int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
        while (true) {
            int[] cur = heap.poll();
            if (cur[1] == n - 1 && cur[2] == n - 1) return cur[0];
            for (int[] d : dirs) {
                int nr = cur[1] + d[0], nc = cur[2] + d[1];
                if (nr >= 0 && nr < n && nc >= 0 && nc < n && !seen[nr][nc]) {
                    seen[nr][nc] = true;
                    heap.add(new int[]{Math.max(cur[0], grid[nr][nc]), nr, nc});
                }
            }
        }
    }
}
