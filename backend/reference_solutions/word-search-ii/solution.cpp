class Solution {
    struct Node {
        Node* child[26] = {};
        int word = -1;
    };

    void dfs(vector<vector<char>>& board, int r, int c, Node* parent, vector<string>& words, vector<string>& found) {
        char ch = board[r][c];
        Node* node = parent->child[ch - 'a'];
        if (!node) return;
        if (node->word >= 0) { found.push_back(words[node->word]); node->word = -1; }
        board[r][c] = '#';
        int dr[] = {1, -1, 0, 0}, dc[] = {0, 0, 1, -1};
        for (int d = 0; d < 4; d++) {
            int nr = r + dr[d], nc = c + dc[d];
            if (nr >= 0 && nr < (int)board.size() && nc >= 0 && nc < (int)board[0].size() && board[nr][nc] != '#')
                dfs(board, nr, nc, node, words, found);
        }
        board[r][c] = ch;
    }

public:
    vector<string> findWords(vector<vector<char>>& board, vector<string>& words) {
        Node* root = new Node();
        for (int i = 0; i < (int)words.size(); i++) {
            Node* node = root;
            for (char ch : words[i]) {
                if (!node->child[ch - 'a']) node->child[ch - 'a'] = new Node();
                node = node->child[ch - 'a'];
            }
            node->word = i;
        }
        vector<string> found;
        for (int r = 0; r < (int)board.size(); r++)
            for (int c = 0; c < (int)board[0].size(); c++)
                dfs(board, r, c, root, words, found);
        return found;
    }
};
