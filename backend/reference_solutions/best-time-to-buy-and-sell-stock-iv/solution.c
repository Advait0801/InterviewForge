int maxProfit(int k, int* prices, int pricesSize) {
    int* buy = (int*)malloc((k + 1) * sizeof(int));
    int* sell = (int*)calloc(k + 1, sizeof(int));
    for (int t = 0; t <= k; t++) buy[t] = -1000000000;
    for (int d = 0; d < pricesSize; d++) {
        for (int t = 1; t <= k; t++) {
            if (sell[t - 1] - prices[d] > buy[t]) buy[t] = sell[t - 1] - prices[d];
            if (buy[t] + prices[d] > sell[t]) sell[t] = buy[t] + prices[d];
        }
    }
    int result = sell[k];
    free(buy);
    free(sell);
    return result;
}
