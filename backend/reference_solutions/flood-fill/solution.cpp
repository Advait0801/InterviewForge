class Solution {
    void fill(vector<vector<int>>& image, int r, int c, int from, int to) {
        if (r < 0 || r >= (int)image.size() || c < 0 || c >= (int)image[0].size() || image[r][c] != from) return;
        image[r][c] = to;
        fill(image, r + 1, c, from, to);
        fill(image, r - 1, c, from, to);
        fill(image, r, c + 1, from, to);
        fill(image, r, c - 1, from, to);
    }
public:
    vector<vector<int>> floodFill(vector<vector<int>>& image, int sr, int sc, int color) {
        if (image[sr][sc] != color) fill(image, sr, sc, image[sr][sc], color);
        return image;
    }
};
