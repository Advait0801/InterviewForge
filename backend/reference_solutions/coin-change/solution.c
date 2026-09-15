int coinChange(int* coins, int coinsSize, int amount) {
    int inf = amount + 1;
    int* dp = (int*)malloc(sizeof(int) * (amount + 1));
    dp[0] = 0;
    for (int a = 1; a <= amount; a++) {
        dp[a] = inf;
        for (int i = 0; i < coinsSize; i++)
            if (coins[i] <= a && dp[a - coins[i]] + 1 < dp[a]) dp[a] = dp[a - coins[i]] + 1;
    }
    int result = dp[amount] == inf ? -1 : dp[amount];
    free(dp);
    return result;
}
