class Solution:
    def isValidSudoku(self, board: List[List[str]]) -> bool:
        rows, cols, boxes = [0] * 9, [0] * 9, [0] * 9
        for r in range(9):
            for c in range(9):
                ch = board[r][c]
                if ch == ".":
                    continue
                bit, b = 1 << (ord(ch) - 49), (r // 3) * 3 + c // 3
                if rows[r] & bit or cols[c] & bit or boxes[b] & bit:
                    return False
                rows[r] |= bit
                cols[c] |= bit
                boxes[b] |= bit
        return True
