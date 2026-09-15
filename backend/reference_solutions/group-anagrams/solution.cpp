class Solution {
public:
    vector<vector<string>> groupAnagrams(vector<string>& strs) {
        unordered_map<string, vector<string>> groups;
        vector<string> order;
        for (auto& w : strs) {
            string key = w;
            sort(key.begin(), key.end());
            if (!groups.count(key)) order.push_back(key);
            groups[key].push_back(w);
        }
        vector<vector<string>> out;
        for (auto& key : order) out.push_back(groups[key]);
        return out;
    }
};
