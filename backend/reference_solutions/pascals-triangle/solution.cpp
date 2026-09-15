class Solution {
public:
    vector<vector<int>> generate(int numRows) {
        vector<vector<int>> rows;
        for (int r = 0; r < numRows; r++) {
            vector<int> row(r + 1, 1);
            for (int c = 1; c < r; c++) row[c] = rows[r - 1][c - 1] + rows[r - 1][c];
            rows.push_back(row);
        }
        return rows;
    }
};
