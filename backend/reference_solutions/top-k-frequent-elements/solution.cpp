class Solution {
public:
    vector<int> topKFrequent(vector<int>& nums, int k) {
        unordered_map<int, int> freq;
        for (int x : nums) freq[x]++;
        vector<pair<int, int>> items(freq.begin(), freq.end());
        sort(items.begin(), items.end(), [](const pair<int,int>& a, const pair<int,int>& b) {
            return a.second != b.second ? a.second > b.second : a.first < b.first;
        });
        vector<int> out;
        for (int i = 0; i < k && i < (int)items.size(); i++) out.push_back(items[i].first);
        return out;
    }
};
