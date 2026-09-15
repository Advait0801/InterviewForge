class Solution {
public:
    int maxProfit(int k, vector<int>& prices) {
        vector<int> buy(k + 1, -1000000000), sell(k + 1, 0);
        for (int p : prices)
            for (int t = 1; t <= k; t++) {
                buy[t] = max(buy[t], sell[t - 1] - p);
                sell[t] = max(sell[t], buy[t] + p);
            }
        return sell[k];
    }
};
