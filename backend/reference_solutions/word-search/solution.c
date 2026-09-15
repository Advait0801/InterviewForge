static bool traceWord(char** board, int rows, int* cols, int r, int c, const char* w) {
    if (!*w) return true;
    if (r < 0 || r >= rows || c < 0 || c >= cols[r] || board[r][c] != *w) return false;
    char saved = board[r][c];
    board[r][c] = '#';
    bool found = traceWord(board, rows, cols, r + 1, c, w + 1) || traceWord(board, rows, cols, r - 1, c, w + 1)
              || traceWord(board, rows, cols, r, c + 1, w + 1) || traceWord(board, rows, cols, r, c - 1, w + 1);
    board[r][c] = saved;
    return found;
}
bool exist(char** board, int boardSize, int* boardColSize, char* word) {
    for (int r = 0; r < boardSize; r++)
        for (int c = 0; c < boardColSize[r]; c++)
            if (traceWord(board, boardSize, boardColSize, r, c, word)) return true;
    return false;
}
