class Solution {
public:
    int subarraySum(vector<int>& nums, int k) {
        unordered_map<long long, int> seen;
        seen[0] = 1;
        long long total = 0;
        int count = 0;
        for (int v : nums) {
            total += v;
            auto it = seen.find(total - k);
            if (it != seen.end()) count += it->second;
            seen[total]++;
        }
        return count;
    }
};
