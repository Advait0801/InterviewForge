class Solution {
public:
    int trap(vector<int>& height) {
        int lo = 0, hi = (int)height.size() - 1, leftMax = 0, rightMax = 0, water = 0;
        while (lo < hi) {
            if (height[lo] < height[hi]) {
                leftMax = max(leftMax, height[lo]);
                water += leftMax - height[lo++];
            } else {
                rightMax = max(rightMax, height[hi]);
                water += rightMax - height[hi--];
            }
        }
        return water;
    }
};
