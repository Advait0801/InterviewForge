class Solution {
public:
    int swimInWater(vector<vector<int>>& grid) {
        int n = grid.size();
        priority_queue<array<int, 3>, vector<array<int, 3>>, greater<array<int, 3>>> heap;
        vector<vector<bool>> seen(n, vector<bool>(n, false));
        heap.push({grid[0][0], 0, 0});
        seen[0][0] = true;
        int dr[4] = {1, -1, 0, 0}, dc[4] = {0, 0, 1, -1};
        while (true) {
            auto [t, r, c] = heap.top();
            heap.pop();
            if (r == n - 1 && c == n - 1) return t;
            for (int d = 0; d < 4; d++) {
                int nr = r + dr[d], nc = c + dc[d];
                if (nr >= 0 && nr < n && nc >= 0 && nc < n && !seen[nr][nc]) {
                    seen[nr][nc] = true;
                    heap.push({max(t, grid[nr][nc]), nr, nc});
                }
            }
        }
    }
};
