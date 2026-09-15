class Solution {
    public int largestRectangleArea(int[] heights) {
        Deque<int[]> st = new ArrayDeque<>();  // {start index, height}
        long best = 0;
        int n = heights.length;
        for (int i = 0; i <= n; i++) {
            int h = i == n ? 0 : heights[i];
            int start = i;
            while (!st.isEmpty() && st.peek()[1] >= h) {
                int[] top = st.pop();
                best = Math.max(best, (long) top[1] * (i - top[0]));
                start = top[0];
            }
            st.push(new int[]{start, h});
        }
        return (int) best;
    }
}
