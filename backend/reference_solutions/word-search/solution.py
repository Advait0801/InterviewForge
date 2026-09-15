class Solution:
    def exist(self, board: List[List[str]], word: str) -> bool:
        rows, cols = len(board), len(board[0])
        def trace(r, c, i):
            if i == len(word):
                return True
            if r < 0 or r >= rows or c < 0 or c >= cols or board[r][c] != word[i]:
                return False
            saved, board[r][c] = board[r][c], "#"
            found = trace(r + 1, c, i + 1) or trace(r - 1, c, i + 1) or trace(r, c + 1, i + 1) or trace(r, c - 1, i + 1)
            board[r][c] = saved
            return found
        return any(trace(r, c, 0) for r in range(rows) for c in range(cols))
