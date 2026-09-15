class Solution {
public:
    int change(int amount, vector<int>& coins) {
        vector<long long> ways(amount + 1, 0);
        ways[0] = 1;
        for (int coin : coins)
            for (int a = coin; a <= amount; a++) ways[a] += ways[a - coin];
        return (int)ways[amount];
    }
};
