class Solution {
    public boolean canPartition(int[] nums) {
        int total = 0;
        for (int v : nums) total += v;
        if (total % 2 != 0) return false;
        int half = total / 2;
        boolean[] reachable = new boolean[half + 1];
        reachable[0] = true;
        for (int v : nums)
            for (int s = half; s >= v; s--)
                if (reachable[s - v]) reachable[s] = true;
        return reachable[half];
    }
}
