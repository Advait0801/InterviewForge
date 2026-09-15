class Solution {
public:
    int rob(vector<int>& nums) {
        int take = 0, skip = 0;
        for (int v : nums) {
            int newTake = skip + v;
            skip = max(take, skip);
            take = newTake;
        }
        return max(take, skip);
    }
};
