class Solution {
public:
    int maxArea(vector<int>& height) {
        int lo = 0, hi = (int)height.size() - 1, best = 0;
        while (lo < hi) {
            best = max(best, (hi - lo) * min(height[lo], height[hi]));
            if (height[lo] < height[hi]) lo++; else hi--;
        }
        return best;
    }
};
