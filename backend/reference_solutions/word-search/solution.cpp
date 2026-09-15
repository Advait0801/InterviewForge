class Solution {
    bool trace(vector<vector<char>>& b, const string& w, int r, int c, int i) {
        if (i == (int)w.size()) return true;
        if (r < 0 || r >= (int)b.size() || c < 0 || c >= (int)b[0].size() || b[r][c] != w[i]) return false;
        char saved = b[r][c];
        b[r][c] = '#';
        bool found = trace(b, w, r + 1, c, i + 1) || trace(b, w, r - 1, c, i + 1)
                  || trace(b, w, r, c + 1, i + 1) || trace(b, w, r, c - 1, i + 1);
        b[r][c] = saved;
        return found;
    }
public:
    bool exist(vector<vector<char>>& board, string word) {
        for (int r = 0; r < (int)board.size(); r++)
            for (int c = 0; c < (int)board[0].size(); c++)
                if (trace(board, word, r, c, 0)) return true;
        return false;
    }
};
