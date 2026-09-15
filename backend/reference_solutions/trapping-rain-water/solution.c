int trap(int* height, int heightSize) {
    int lo = 0, hi = heightSize - 1, leftMax = 0, rightMax = 0, water = 0;
    while (lo < hi) {
        if (height[lo] < height[hi]) {
            if (height[lo] > leftMax) leftMax = height[lo];
            water += leftMax - height[lo++];
        } else {
            if (height[hi] > rightMax) rightMax = height[hi];
            water += rightMax - height[hi--];
        }
    }
    return water;
}
