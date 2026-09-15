class Solution {
public:
    bool canPartition(vector<int>& nums) {
        int total = accumulate(nums.begin(), nums.end(), 0);
        if (total % 2) return false;
        int half = total / 2;
        vector<bool> reachable(half + 1, false);
        reachable[0] = true;
        for (int v : nums)
            for (int s = half; s >= v; s--)
                if (reachable[s - v]) reachable[s] = true;
        return reachable[half];
    }
};
