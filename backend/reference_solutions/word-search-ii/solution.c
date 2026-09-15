typedef struct _WNode {
    struct _WNode* child[26];
    int word;
} _WNode;

static _WNode* _wnew(void) {
    _WNode* n = (_WNode*)calloc(1, sizeof(_WNode));
    n->word = -1;
    return n;
}

static void _wdfs(char** board, int rows, int* colSize, int r, int c, _WNode* parent,
                  char** words, char** found, int* count) {
    char ch = board[r][c];
    if (ch < 'a' || ch > 'z') return;
    _WNode* node = parent->child[ch - 'a'];
    if (!node) return;
    if (node->word >= 0) { found[(*count)++] = words[node->word]; node->word = -1; }
    board[r][c] = '#';
    int dr[] = {1, -1, 0, 0}, dc[] = {0, 0, 1, -1};
    for (int d = 0; d < 4; d++) {
        int nr = r + dr[d], nc = c + dc[d];
        if (nr >= 0 && nr < rows && nc >= 0 && nc < colSize[nr])
            _wdfs(board, rows, colSize, nr, nc, node, words, found, count);
    }
    board[r][c] = ch;
}

char** findWords(char** board, int boardSize, int* boardColSize, char** words, int wordsSize, int* returnSize) {
    _WNode* root = _wnew();
    for (int i = 0; i < wordsSize; i++) {
        _WNode* node = root;
        for (char* p = words[i]; *p; p++) {
            int c = *p - 'a';
            if (!node->child[c]) node->child[c] = _wnew();
            node = node->child[c];
        }
        node->word = i;
    }
    char** found = (char**)malloc(sizeof(char*) * (wordsSize ? wordsSize : 1));
    int count = 0;
    for (int r = 0; r < boardSize; r++)
        for (int c = 0; c < boardColSize[r]; c++)
            _wdfs(board, boardSize, boardColSize, r, c, root, words, found, &count);
    *returnSize = count;
    return found;
}
