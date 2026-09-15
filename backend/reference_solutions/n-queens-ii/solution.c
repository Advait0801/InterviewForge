static int queensPlace(int full, int cols, int d1, int d2) {
    if (cols == full) return 1;
    int count = 0, open = full & ~(cols | d1 | d2);
    while (open) {
        int bit = open & -open;
        open -= bit;
        count += queensPlace(full, cols | bit, ((d1 | bit) << 1) & full, (d2 | bit) >> 1);
    }
    return count;
}
int totalNQueens(int n) {
    return queensPlace((1 << n) - 1, 0, 0, 0);
}
