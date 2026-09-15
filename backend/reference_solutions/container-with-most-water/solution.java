class Solution {
    public int maxArea(int[] height) {
        int lo = 0, hi = height.length - 1, best = 0;
        while (lo < hi) {
            best = Math.max(best, (hi - lo) * Math.min(height[lo], height[hi]));
            if (height[lo] < height[hi]) lo++; else hi--;
        }
        return best;
    }
}
