class Solution {
public:
    int largestRectangleArea(vector<int>& heights) {
        vector<pair<int, int>> st;  // (start index, height)
        long long best = 0;
        int n = heights.size();
        for (int i = 0; i <= n; i++) {
            int h = i == n ? 0 : heights[i];
            int start = i;
            while (!st.empty() && st.back().second >= h) {
                best = max(best, (long long)st.back().second * (i - st.back().first));
                start = st.back().first;
                st.pop_back();
            }
            st.push_back({start, h});
        }
        return (int)best;
    }
};
