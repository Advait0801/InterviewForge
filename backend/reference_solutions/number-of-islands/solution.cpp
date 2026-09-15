class Solution {
public:
    int numIslands(vector<vector<char>>& grid) {
        if (grid.empty()) return 0;
        int rows = grid.size(), cols = grid[0].size(), count = 0;
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (grid[r][c] != '1') continue;
                count++;
                vector<pair<int, int>> st{{r, c}};
                grid[r][c] = '0';
                while (!st.empty()) {
                    auto [y, x] = st.back(); st.pop_back();
                    int dy[] = {1, -1, 0, 0}, dx[] = {0, 0, 1, -1};
                    for (int d = 0; d < 4; d++) {
                        int ny = y + dy[d], nx = x + dx[d];
                        if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && grid[ny][nx] == '1') {
                            grid[ny][nx] = '0';
                            st.push_back({ny, nx});
                        }
                    }
                }
            }
        }
        return count;
    }
};
