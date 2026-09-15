int maxProfit(int* prices, int pricesSize) {
    int best = 0, low = prices[0];
    for (int i = 0; i < pricesSize; i++) {
        if (prices[i] < low) low = prices[i];
        if (prices[i] - low > best) best = prices[i] - low;
    }
    return best;
}
