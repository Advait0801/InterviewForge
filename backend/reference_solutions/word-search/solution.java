class Solution {
    private boolean trace(char[][] b, String w, int r, int c, int i) {
        if (i == w.length()) return true;
        if (r < 0 || r >= b.length || c < 0 || c >= b[0].length || b[r][c] != w.charAt(i)) return false;
        char saved = b[r][c];
        b[r][c] = '#';
        boolean found = trace(b, w, r + 1, c, i + 1) || trace(b, w, r - 1, c, i + 1)
                     || trace(b, w, r, c + 1, i + 1) || trace(b, w, r, c - 1, i + 1);
        b[r][c] = saved;
        return found;
    }
    public boolean exist(char[][] board, String word) {
        for (int r = 0; r < board.length; r++)
            for (int c = 0; c < board[0].length; c++)
                if (trace(board, word, r, c, 0)) return true;
        return false;
    }
}
