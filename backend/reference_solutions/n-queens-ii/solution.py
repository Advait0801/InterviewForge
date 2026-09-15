class Solution:
    def totalNQueens(self, n: int) -> int:
        full = (1 << n) - 1
        def place(cols, d1, d2):
            if cols == full:
                return 1
            count, open_cells = 0, full & ~(cols | d1 | d2)
            while open_cells:
                bit = open_cells & -open_cells
                open_cells -= bit
                count += place(cols | bit, ((d1 | bit) << 1) & full, (d2 | bit) >> 1)
            return count
        return place(0, 0, 0)
