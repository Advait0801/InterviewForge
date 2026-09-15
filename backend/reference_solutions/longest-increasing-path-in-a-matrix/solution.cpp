class Solution {
    int m, n;
    vector<vector<int>> memo;
    int longest(vector<vector<int>>& mat, int r, int c) {
        if (memo[r][c]) return memo[r][c];
        int dr[4] = {1, -1, 0, 0}, dc[4] = {0, 0, 1, -1}, best = 1;
        for (int d = 0; d < 4; d++) {
            int nr = r + dr[d], nc = c + dc[d];
            if (nr >= 0 && nr < m && nc >= 0 && nc < n && mat[nr][nc] > mat[r][c])
                best = max(best, 1 + longest(mat, nr, nc));
        }
        return memo[r][c] = best;
    }
public:
    int longestIncreasingPath(vector<vector<int>>& matrix) {
        m = matrix.size();
        n = matrix[0].size();
        memo.assign(m, vector<int>(n, 0));
        int best = 0;
        for (int r = 0; r < m; r++)
            for (int c = 0; c < n; c++) best = max(best, longest(matrix, r, c));
        return best;
    }
};
