class Solution {
public:
    int calculateMinimumHP(vector<vector<int>>& dungeon) {
        int m = dungeon.size(), n = dungeon[0].size();
        vector<vector<int>> need(m + 1, vector<int>(n + 1, INT_MAX));
        need[m][n - 1] = need[m - 1][n] = 1;
        for (int r = m - 1; r >= 0; r--)
            for (int c = n - 1; c >= 0; c--)
                need[r][c] = max(1, min(need[r + 1][c], need[r][c + 1]) - dungeon[r][c]);
        return need[0][0];
    }
};
