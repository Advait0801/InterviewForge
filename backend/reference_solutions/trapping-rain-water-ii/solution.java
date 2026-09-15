class Solution {
    public int trapRainWater(int[][] heightMap) {
        int m = heightMap.length, n = heightMap[0].length;
        if (m < 3 || n < 3) return 0;
        PriorityQueue<int[]> heap = new PriorityQueue<>((a, b) -> Integer.compare(a[0], b[0]));
        boolean[][] seen = new boolean[m][n];
        for (int r = 0; r < m; r++)
            for (int c = 0; c < n; c++)
                if (r == 0 || r == m - 1 || c == 0 || c == n - 1) { heap.add(new int[]{heightMap[r][c], r, c}); seen[r][c] = true; }
        int water = 0;
        int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
        while (!heap.isEmpty()) {
            int[] cur = heap.poll();
            for (int[] d : dirs) {
                int nr = cur[1] + d[0], nc = cur[2] + d[1];
                if (nr < 0 || nr >= m || nc < 0 || nc >= n || seen[nr][nc]) continue;
                seen[nr][nc] = true;
                water += Math.max(0, cur[0] - heightMap[nr][nc]);
                heap.add(new int[]{Math.max(cur[0], heightMap[nr][nc]), nr, nc});
            }
        }
        return water;
    }
}
