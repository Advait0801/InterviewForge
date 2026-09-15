class Solution {
    private int place(int full, int cols, int d1, int d2) {
        if (cols == full) return 1;
        int count = 0, open = full & ~(cols | d1 | d2);
        while (open != 0) {
            int bit = open & -open;
            open -= bit;
            count += place(full, cols | bit, ((d1 | bit) << 1) & full, (d2 | bit) >> 1);
        }
        return count;
    }
    public int totalNQueens(int n) { return place((1 << n) - 1, 0, 0, 0); }
}
