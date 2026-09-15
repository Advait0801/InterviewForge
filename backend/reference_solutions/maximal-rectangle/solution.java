class Solution {
    public int maximalRectangle(char[][] matrix) {
        int n = matrix[0].length, best = 0;
        int[] heights = new int[n + 1], stack = new int[n + 2];
        for (char[] row : matrix) {
            for (int c = 0; c < n; c++) heights[c] = row[c] == '1' ? heights[c] + 1 : 0;
            int top = 0;
            stack[top++] = -1;
            for (int c = 0; c <= n; c++) {
                while (stack[top - 1] != -1 && heights[stack[top - 1]] >= heights[c]) {
                    int h = heights[stack[--top]];
                    best = Math.max(best, h * (c - stack[top - 1] - 1));
                }
                stack[top++] = c;
            }
        }
        return best;
    }
}
