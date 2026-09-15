class Solution {
    void search(vector<int>& cands, int start, int remain, vector<int>& path, vector<vector<int>>& out) {
        if (remain == 0) { out.push_back(path); return; }
        for (int i = start; i < (int)cands.size(); i++) {
            if (cands[i] <= remain) {
                path.push_back(cands[i]);
                search(cands, i, remain - cands[i], path, out);
                path.pop_back();
            }
        }
    }
public:
    vector<vector<int>> combinationSum(vector<int>& candidates, int target) {
        vector<vector<int>> out;
        vector<int> path;
        search(candidates, 0, target, path, out);
        return out;
    }
};
