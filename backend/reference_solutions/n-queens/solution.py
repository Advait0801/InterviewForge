class Solution:
    def solveNQueens(self, n: int) -> List[List[str]]:
        out, cols = [], [0] * n
        used_col, diag, anti = set(), set(), set()

        def place(row):
            if row == n:
                out.append(["." * c + "Q" + "." * (n - c - 1) for c in cols])
                return
            for c in range(n):
                if c in used_col or row - c in diag or row + c in anti:
                    continue
                cols[row] = c
                used_col.add(c); diag.add(row - c); anti.add(row + c)
                place(row + 1)
                used_col.remove(c); diag.remove(row - c); anti.remove(row + c)

        place(0)
        return out
