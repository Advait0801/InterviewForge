impl Solution {
    pub fn exist(mut board: Vec<Vec<char>>, word: String) -> bool {
        fn dfs(b: &mut Vec<Vec<char>>, r: i32, c: i32, w: &[char]) -> bool {
            if w.is_empty() {
                return true;
            }
            if r < 0 || c < 0 || r as usize >= b.len() || c as usize >= b[0].len() || b[r as usize][c as usize] != w[0] {
                return false;
            }
            let ch = b[r as usize][c as usize];
            b[r as usize][c as usize] = '#';
            let found = dfs(b, r + 1, c, &w[1..]) || dfs(b, r - 1, c, &w[1..]) || dfs(b, r, c + 1, &w[1..]) || dfs(b, r, c - 1, &w[1..]);
            b[r as usize][c as usize] = ch;
            found
        }
        let w: Vec<char> = word.chars().collect();
        for r in 0..board.len() {
            for c in 0..board[0].len() {
                if dfs(&mut board, r as i32, c as i32, &w) {
                    return true;
                }
            }
        }
        false
    }
}
