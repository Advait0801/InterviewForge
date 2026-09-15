class Solution {
public:
    int maxProduct(vector<int>& nums) {
        long long hi = nums[0], lo = nums[0], best = nums[0];
        for (size_t i = 1; i < nums.size(); i++) {
            long long v = nums[i], a = hi * v, b = lo * v;
            hi = max({v, a, b});
            lo = min({v, a, b});
            best = max(best, hi);
        }
        return (int)best;
    }
};
