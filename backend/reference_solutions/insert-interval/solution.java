class Solution {
    public int[][] insert(int[][] intervals, int[] newInterval) {
        List<int[]> out = new ArrayList<>();
        int start = newInterval[0], end = newInterval[1], i = 0;
        while (i < intervals.length && intervals[i][1] < start) out.add(intervals[i++]);
        while (i < intervals.length && intervals[i][0] <= end) {
            start = Math.min(start, intervals[i][0]);
            end = Math.max(end, intervals[i][1]);
            i++;
        }
        out.add(new int[]{start, end});
        while (i < intervals.length) out.add(intervals[i++]);
        return out.toArray(new int[0][]);
    }
}
