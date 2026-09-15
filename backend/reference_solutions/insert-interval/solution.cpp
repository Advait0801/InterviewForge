class Solution {
public:
    vector<vector<int>> insert(vector<vector<int>>& intervals, vector<int>& newInterval) {
        vector<vector<int>> out;
        int start = newInterval[0], end = newInterval[1];
        size_t i = 0;
        while (i < intervals.size() && intervals[i][1] < start) out.push_back(intervals[i++]);
        while (i < intervals.size() && intervals[i][0] <= end) {
            start = min(start, intervals[i][0]);
            end = max(end, intervals[i][1]);
            i++;
        }
        out.push_back({start, end});
        while (i < intervals.size()) out.push_back(intervals[i++]);
        return out;
    }
};
