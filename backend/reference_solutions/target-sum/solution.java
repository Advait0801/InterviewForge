class Solution {
    public int findTargetSumWays(int[] nums, int target) {
        int total = 0;
        for (int v : nums) total += v;
        if (Math.abs(target) > total) return 0;
        int[] ways = new int[2 * total + 1];
        ways[total] = 1;
        for (int v : nums) {
            int[] next = new int[2 * total + 1];
            for (int s = 0; s <= 2 * total; s++) {
                if (ways[s] == 0) continue;
                if (s + v <= 2 * total) next[s + v] += ways[s];
                if (s - v >= 0) next[s - v] += ways[s];
            }
            ways = next;
        }
        return ways[target + total];
    }
}
