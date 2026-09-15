class Solution {
public:
    int missingNumber(vector<int>& nums) {
        long long n = nums.size(), total = n * (n + 1) / 2;
        for (int x : nums) total -= x;
        return (int)total;
    }
};
