class Solution {
public:
    int islandPerimeter(vector<vector<int>>& grid) {
        int land = 0, shared = 0;
        for (size_t r = 0; r < grid.size(); r++) {
            for (size_t c = 0; c < grid[r].size(); c++) {
                if (!grid[r][c]) continue;
                land++;
                if (r + 1 < grid.size() && grid[r + 1][c]) shared++;
                if (c + 1 < grid[r].size() && grid[r][c + 1]) shared++;
            }
        }
        return 4 * land - 2 * shared;
    }
};
