class Solution {
public:
    int maximalRectangle(vector<vector<char>>& matrix) {
        int n = matrix[0].size(), best = 0;
        vector<int> heights(n + 1, 0);
        for (auto& row : matrix) {
            for (int c = 0; c < n; c++) heights[c] = row[c] == '1' ? heights[c] + 1 : 0;
            vector<int> stack = {-1};
            for (int c = 0; c <= n; c++) {
                while (stack.back() != -1 && heights[stack.back()] >= heights[c]) {
                    int h = heights[stack.back()];
                    stack.pop_back();
                    best = max(best, h * (c - stack.back() - 1));
                }
                stack.push_back(c);
            }
        }
        return best;
    }
};
