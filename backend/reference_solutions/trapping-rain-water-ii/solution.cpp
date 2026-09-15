class Solution {
public:
    int trapRainWater(vector<vector<int>>& heightMap) {
        int m = heightMap.size(), n = heightMap[0].size();
        if (m < 3 || n < 3) return 0;
        priority_queue<array<int, 3>, vector<array<int, 3>>, greater<array<int, 3>>> heap;
        vector<vector<bool>> seen(m, vector<bool>(n, false));
        for (int r = 0; r < m; r++)
            for (int c = 0; c < n; c++)
                if (r == 0 || r == m - 1 || c == 0 || c == n - 1) { heap.push({heightMap[r][c], r, c}); seen[r][c] = true; }
        int water = 0, dr[4] = {1, -1, 0, 0}, dc[4] = {0, 0, 1, -1};
        while (!heap.empty()) {
            auto [level, r, c] = heap.top();
            heap.pop();
            for (int d = 0; d < 4; d++) {
                int nr = r + dr[d], nc = c + dc[d];
                if (nr < 0 || nr >= m || nc < 0 || nc >= n || seen[nr][nc]) continue;
                seen[nr][nc] = true;
                water += max(0, level - heightMap[nr][nc]);
                heap.push({max(level, heightMap[nr][nc]), nr, nc});
            }
        }
        return water;
    }
};
