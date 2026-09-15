class Solution {
    public int maxProfit(int[] prices) {
        int best = 0, low = Integer.MAX_VALUE;
        for (int p : prices) { low = Math.min(low, p); best = Math.max(best, p - low); }
        return best;
    }
}
