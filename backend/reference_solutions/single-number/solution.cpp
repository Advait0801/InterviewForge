class Solution {
public:
    int singleNumber(vector<int>& nums) {
        int acc = 0;
        for (int v : nums) acc ^= v;
        return acc;
    }
};
