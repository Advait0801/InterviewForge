class Solution {
    vector<vector<string>> out;
    vector<int> cols;
    vector<bool> usedCol, diag, anti;
    int n;

    void place(int row) {
        if (row == n) {
            vector<string> board(n, string(n, '.'));
            for (int r = 0; r < n; r++) board[r][cols[r]] = 'Q';
            out.push_back(board);
            return;
        }
        for (int c = 0; c < n; c++) {
            if (usedCol[c] || diag[row - c + n - 1] || anti[row + c]) continue;
            cols[row] = c;
            usedCol[c] = diag[row - c + n - 1] = anti[row + c] = true;
            place(row + 1);
            usedCol[c] = diag[row - c + n - 1] = anti[row + c] = false;
        }
    }

public:
    vector<vector<string>> solveNQueens(int n) {
        this->n = n;
        cols.assign(n, 0);
        usedCol.assign(n, false);
        diag.assign(2 * n, false);
        anti.assign(2 * n, false);
        out.clear();
        place(0);
        return out;
    }
};
