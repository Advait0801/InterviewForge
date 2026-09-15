class Solution {
    public int change(int amount, int[] coins) {
        long[] ways = new long[amount + 1];
        ways[0] = 1;
        for (int coin : coins)
            for (int a = coin; a <= amount; a++) ways[a] += ways[a - coin];
        return (int) ways[amount];
    }
}
