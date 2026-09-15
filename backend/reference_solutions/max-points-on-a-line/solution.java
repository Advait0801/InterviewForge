class Solution {
    private int gcd(int a, int b) { return b == 0 ? a : gcd(b, a % b); }
    public int maxPoints(int[][] points) {
        int n = points.length;
        if (n <= 2) return n;
        int best = 1;
        for (int i = 0; i < n; i++) {
            Map<Long, Integer> slopes = new HashMap<>();
            for (int j = i + 1; j < n; j++) {
                int dx = points[j][0] - points[i][0], dy = points[j][1] - points[i][1];
                int g = gcd(Math.abs(dx), Math.abs(dy));
                dx /= g;
                dy /= g;
                if (dx < 0 || (dx == 0 && dy < 0)) { dx = -dx; dy = -dy; }
                long key = ((long) dx << 32) ^ (dy & 0xffffffffL);
                best = Math.max(best, slopes.merge(key, 1, Integer::sum) + 1);
            }
        }
        return best;
    }
}
