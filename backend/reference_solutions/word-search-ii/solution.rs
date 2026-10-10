use std::collections::HashMap;

#[derive(Default)]
struct Node {
    next: HashMap<char, Node>,
    word: Option<String>,
}

impl Solution {
    pub fn find_words(mut board: Vec<Vec<char>>, words: Vec<String>) -> Vec<String> {
        let mut root = Node::default();
        for w in words {
            let mut node = &mut root;
            for c in w.chars() {
                node = node.next.entry(c).or_default();
            }
            node.word = Some(w);
        }
        fn dfs(board: &mut Vec<Vec<char>>, r: usize, c: usize, parent: &mut Node, found: &mut Vec<String>) {
            let ch = board[r][c];
            let node = match parent.next.get_mut(&ch) {
                Some(n) => n,
                None => return,
            };
            if let Some(w) = node.word.take() {
                found.push(w);
            }
            board[r][c] = '#';
            let (rows, cols) = (board.len(), board[0].len());
            if r > 0 && board[r - 1][c] != '#' { dfs(board, r - 1, c, node, found); }
            if r + 1 < rows && board[r + 1][c] != '#' { dfs(board, r + 1, c, node, found); }
            if c > 0 && board[r][c - 1] != '#' { dfs(board, r, c - 1, node, found); }
            if c + 1 < cols && board[r][c + 1] != '#' { dfs(board, r, c + 1, node, found); }
            board[r][c] = ch;
        }
        let mut found = vec![];
        for r in 0..board.len() {
            for c in 0..board[0].len() {
                dfs(&mut board, r, c, &mut root, &mut found);
            }
        }
        found
    }
}
