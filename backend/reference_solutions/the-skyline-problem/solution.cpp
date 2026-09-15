class Solution {
public:
    vector<vector<int>> getSkyline(vector<vector<int>>& buildings) {
        vector<long long> xs;
        for (auto& b : buildings) { xs.push_back(b[0]); xs.push_back(b[1]); }
        sort(xs.begin(), xs.end());
        xs.erase(unique(xs.begin(), xs.end()), xs.end());
        priority_queue<pair<int, int>> heap;  // (height, right)
        vector<vector<int>> out;
        size_t i = 0;
        for (long long x : xs) {
            while (i < buildings.size() && buildings[i][0] <= x) { heap.push({buildings[i][2], buildings[i][1]}); i++; }
            while (!heap.empty() && heap.top().second <= x) heap.pop();
            int height = heap.empty() ? 0 : heap.top().first;
            if (out.empty() || out.back()[1] != height) out.push_back({(int)x, height});
        }
        return out;
    }
};
