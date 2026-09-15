class Solution {
public:
    vector<int> countSmaller(vector<int>& nums) {
        const int offset = 10001, size = 20002;
        vector<int> tree(size + 1, 0), out(nums.size());
        for (int i = (int)nums.size() - 1; i >= 0; i--) {
            int idx = nums[i] + offset, total = 0;
            for (int q = idx - 1; q > 0; q -= q & -q) total += tree[q];
            out[i] = total;
            for (; idx <= size; idx += idx & -idx) tree[idx]++;
        }
        return out;
    }
};
