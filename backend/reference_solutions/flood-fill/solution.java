class Solution {
    private void fill(int[][] image, int r, int c, int from, int to) {
        if (r < 0 || r >= image.length || c < 0 || c >= image[0].length || image[r][c] != from) return;
        image[r][c] = to;
        fill(image, r + 1, c, from, to);
        fill(image, r - 1, c, from, to);
        fill(image, r, c + 1, from, to);
        fill(image, r, c - 1, from, to);
    }
    public int[][] floodFill(int[][] image, int sr, int sc, int color) {
        if (image[sr][sc] != color) fill(image, sr, sc, image[sr][sc], color);
        return image;
    }
}
