class Solution {
public:
    vector<int> intersection(vector<int>& nums1, vector<int>& nums2) {
        vector<bool> present(1001, false);
        for (int v : nums1) present[v] = true;
        vector<int> out;
        for (int v : nums2) if (present[v]) { present[v] = false; out.push_back(v); }
        return out;
    }
};
