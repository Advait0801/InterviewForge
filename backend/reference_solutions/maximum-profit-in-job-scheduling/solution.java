class Solution {
    public int jobScheduling(int[] startTime, int[] endTime, int[] profit) {
        int n = startTime.length;
        int[][] jobs = new int[n][];
        for (int i = 0; i < n; i++) jobs[i] = new int[]{endTime[i], startTime[i], profit[i]};
        Arrays.sort(jobs, (a, b) -> Integer.compare(a[0], b[0]));
        long[] dp = new long[n + 1];
        for (int i = 1; i <= n; i++) {
            int start = jobs[i - 1][1];
            int lo = 0, hi = i - 1;  // first job index (in [0, i-1)) whose end > start
            while (lo < hi) {
                int mid = (lo + hi) / 2;
                if (jobs[mid][0] <= start) lo = mid + 1; else hi = mid;
            }
            dp[i] = Math.max(dp[i - 1], dp[lo] + jobs[i - 1][2]);
        }
        return (int) dp[n];
    }
}
