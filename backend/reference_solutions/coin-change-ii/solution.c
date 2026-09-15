int change(int amount, int* coins, int coinsSize) {
    long long* ways = (long long*)calloc(amount + 1, sizeof(long long));
    ways[0] = 1;
    for (int i = 0; i < coinsSize; i++)
        for (int a = coins[i]; a <= amount; a++) ways[a] += ways[a - coins[i]];
    int result = (int)ways[amount];
    free(ways);
    return result;
}
