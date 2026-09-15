class Solution {
    public int eraseOverlapIntervals(int[][] intervals) {
        java.util.Arrays.sort(intervals, (a, b) -> Integer.compare(a[1], b[1]));
        int removed = 0;
        long lastEnd = Long.MIN_VALUE;
        for (int[] iv : intervals) {
            if (iv[0] >= lastEnd) lastEnd = iv[1];
            else removed++;
        }
        return removed;
    }
}
