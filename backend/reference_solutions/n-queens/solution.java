class Solution {
    public List<List<String>> solveNQueens(int n) {
        List<List<String>> out = new ArrayList<>();
        place(0, n, new int[n], new boolean[n], new boolean[2 * n], new boolean[2 * n], out);
        return out;
    }

    private void place(int row, int n, int[] cols, boolean[] usedCol, boolean[] diag, boolean[] anti, List<List<String>> out) {
        if (row == n) {
            List<String> board = new ArrayList<>();
            for (int r = 0; r < n; r++) {
                char[] line = new char[n];
                Arrays.fill(line, '.');
                line[cols[r]] = 'Q';
                board.add(new String(line));
            }
            out.add(board);
            return;
        }
        for (int c = 0; c < n; c++) {
            if (usedCol[c] || diag[row - c + n - 1] || anti[row + c]) continue;
            cols[row] = c;
            usedCol[c] = diag[row - c + n - 1] = anti[row + c] = true;
            place(row + 1, n, cols, usedCol, diag, anti, out);
            usedCol[c] = diag[row - c + n - 1] = anti[row + c] = false;
        }
    }
}
