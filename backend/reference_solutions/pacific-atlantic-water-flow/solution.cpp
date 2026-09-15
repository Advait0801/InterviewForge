class Solution {
    void climb(vector<vector<int>>& h, int r, int c, vector<vector<bool>>& seen) {
        seen[r][c] = true;
        int dr[4] = {1, -1, 0, 0}, dc[4] = {0, 0, 1, -1};
        for (int d = 0; d < 4; d++) {
            int nr = r + dr[d], nc = c + dc[d];
            if (nr >= 0 && nr < (int)h.size() && nc >= 0 && nc < (int)h[0].size() && !seen[nr][nc] && h[nr][nc] >= h[r][c])
                climb(h, nr, nc, seen);
        }
    }
public:
    vector<vector<int>> pacificAtlantic(vector<vector<int>>& heights) {
        int m = heights.size(), n = heights[0].size();
        vector<vector<bool>> pacific(m, vector<bool>(n)), atlantic(m, vector<bool>(n));
        for (int r = 0; r < m; r++) {
            if (!pacific[r][0]) climb(heights, r, 0, pacific);
            if (!atlantic[r][n - 1]) climb(heights, r, n - 1, atlantic);
        }
        for (int c = 0; c < n; c++) {
            if (!pacific[0][c]) climb(heights, 0, c, pacific);
            if (!atlantic[m - 1][c]) climb(heights, m - 1, c, atlantic);
        }
        vector<vector<int>> out;
        for (int r = 0; r < m; r++)
            for (int c = 0; c < n; c++)
                if (pacific[r][c] && atlantic[r][c]) out.push_back({r, c});
        return out;
    }
};
