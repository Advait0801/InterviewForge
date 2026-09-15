class Solution {
public:
    int findTargetSumWays(vector<int>& nums, int target) {
        int total = accumulate(nums.begin(), nums.end(), 0);
        if (abs(target) > total) return 0;
        vector<int> ways(2 * total + 1, 0);
        ways[total] = 1;
        for (int v : nums) {
            vector<int> next(2 * total + 1, 0);
            for (int s = 0; s <= 2 * total; s++) {
                if (!ways[s]) continue;
                if (s + v <= 2 * total) next[s + v] += ways[s];
                if (s - v >= 0) next[s - v] += ways[s];
            }
            ways = next;
        }
        return ways[target + total];
    }
};
