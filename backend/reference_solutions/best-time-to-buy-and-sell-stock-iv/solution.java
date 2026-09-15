class Solution {
    public int maxProfit(int k, int[] prices) {
        int[] buy = new int[k + 1], sell = new int[k + 1];
        java.util.Arrays.fill(buy, -1000000000);
        for (int p : prices)
            for (int t = 1; t <= k; t++) {
                buy[t] = Math.max(buy[t], sell[t - 1] - p);
                sell[t] = Math.max(sell[t], buy[t] + p);
            }
        return sell[k];
    }
}
