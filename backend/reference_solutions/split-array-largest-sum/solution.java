class Solution {
    public int splitArray(int[] nums, int k) {
        long lo = 0, hi = 0;
        for (int v : nums) { lo = Math.max(lo, v); hi += v; }
        while (lo < hi) {
            long mid = (lo + hi) / 2, current = 0;
            int pieces = 1;
            for (int v : nums) {
                if (current + v > mid) { pieces++; current = 0; }
                current += v;
            }
            if (pieces <= k) hi = mid; else lo = mid + 1;
        }
        return (int) lo;
    }
}
