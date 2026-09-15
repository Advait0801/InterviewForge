class Solution {
    int line(vector<int>& nums, int lo, int hi) {
        int take = 0, skip = 0;
        for (int i = lo; i < hi; i++) {
            int newTake = skip + nums[i];
            skip = max(take, skip);
            take = newTake;
        }
        return max(take, skip);
    }
public:
    int rob(vector<int>& nums) {
        int n = nums.size();
        if (n == 1) return nums[0];
        return max(line(nums, 0, n - 1), line(nums, 1, n));
    }
};
