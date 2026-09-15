class Solution {
public:
    int splitArray(vector<int>& nums, int k) {
        long long lo = *max_element(nums.begin(), nums.end()), hi = accumulate(nums.begin(), nums.end(), 0LL);
        while (lo < hi) {
            long long mid = (lo + hi) / 2, current = 0;
            int pieces = 1;
            for (int v : nums) {
                if (current + v > mid) { pieces++; current = 0; }
                current += v;
            }
            if (pieces <= k) hi = mid; else lo = mid + 1;
        }
        return (int)lo;
    }
};
