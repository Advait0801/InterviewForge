int maxArea(int* height, int heightSize) {
    int lo = 0, hi = heightSize - 1, best = 0;
    while (lo < hi) {
        int h = height[lo] < height[hi] ? height[lo] : height[hi];
        if ((hi - lo) * h > best) best = (hi - lo) * h;
        if (height[lo] < height[hi]) lo++; else hi--;
    }
    return best;
}
