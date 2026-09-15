class Solution {
public:
    vector<vector<int>> subsets(vector<int>& nums) {
        vector<vector<int>> out = {{}};
        for (int v : nums) {
            int size = out.size();
            for (int i = 0; i < size; i++) {
                vector<int> next = out[i];
                next.push_back(v);
                out.push_back(next);
            }
        }
        return out;
    }
};
