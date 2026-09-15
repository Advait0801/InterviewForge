class Solution {
public:
    int longestConsecutive(vector<int>& nums) {
        unordered_set<long long> values(nums.begin(), nums.end());
        int best = 0;
        for (long long v : values) {
            if (values.count(v - 1)) continue;
            int length = 1;
            while (values.count(v + length)) length++;
            best = max(best, length);
        }
        return best;
    }
};
