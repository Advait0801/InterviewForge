int maxProfit(int* prices, int pricesSize) {
    int buy1 = -1000000000, buy2 = -1000000000, sell1 = 0, sell2 = 0;
    for (int i = 0; i < pricesSize; i++) {
        int p = prices[i];
        if (-p > buy1) buy1 = -p;
        if (buy1 + p > sell1) sell1 = buy1 + p;
        if (sell1 - p > buy2) buy2 = sell1 - p;
        if (buy2 + p > sell2) sell2 = buy2 + p;
    }
    return sell2;
}
