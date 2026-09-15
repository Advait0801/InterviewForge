class Solution {
    public int leastInterval(char[] tasks, int n) {
        int[] counts = new int[26];
        for (char t : tasks) counts[t - 'A']++;
        int peak = 0, atPeak = 0;
        for (int c : counts) peak = Math.max(peak, c);
        for (int c : counts) if (c == peak) atPeak++;
        return Math.max(tasks.length, (peak - 1) * (n + 1) + atPeak);
    }
}
