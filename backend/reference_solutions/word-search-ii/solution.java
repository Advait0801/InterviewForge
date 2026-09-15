class Solution {
    private static class Node {
        Node[] child = new Node[26];
        String word;
    }

    private void dfs(char[][] board, int r, int c, Node parent, List<String> found) {
        char ch = board[r][c];
        Node node = parent.child[ch - 'a'];
        if (node == null) return;
        if (node.word != null) { found.add(node.word); node.word = null; }
        board[r][c] = '#';
        int[] dr = {1, -1, 0, 0}, dc = {0, 0, 1, -1};
        for (int d = 0; d < 4; d++) {
            int nr = r + dr[d], nc = c + dc[d];
            if (nr >= 0 && nr < board.length && nc >= 0 && nc < board[0].length && board[nr][nc] != '#')
                dfs(board, nr, nc, node, found);
        }
        board[r][c] = ch;
    }

    public List<String> findWords(char[][] board, String[] words) {
        Node root = new Node();
        for (String w : words) {
            Node node = root;
            for (char ch : w.toCharArray()) {
                if (node.child[ch - 'a'] == null) node.child[ch - 'a'] = new Node();
                node = node.child[ch - 'a'];
            }
            node.word = w;
        }
        List<String> found = new ArrayList<>();
        for (int r = 0; r < board.length; r++)
            for (int c = 0; c < board[0].length; c++)
                dfs(board, r, c, root, found);
        return found;
    }
}
