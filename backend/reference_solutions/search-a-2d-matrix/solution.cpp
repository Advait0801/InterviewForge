class Solution {
public:
    bool searchMatrix(vector<vector<int>>& matrix, int target) {
        int n = matrix[0].size();
        int lo = 0, hi = (int)matrix.size() * n - 1;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            int v = matrix[mid / n][mid % n];
            if (v == target) return true;
            if (v < target) lo = mid + 1; else hi = mid - 1;
        }
        return false;
    }
};
