class Solution {
public:
    int maxProfit(vector<int>& prices) {
        int buy1 = INT_MIN / 2, buy2 = INT_MIN / 2, sell1 = 0, sell2 = 0;
        for (int p : prices) {
            buy1 = max(buy1, -p);
            sell1 = max(sell1, buy1 + p);
            buy2 = max(buy2, sell1 - p);
            sell2 = max(sell2, buy2 + p);
        }
        return sell2;
    }
};
