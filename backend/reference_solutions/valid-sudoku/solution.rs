impl Solution {
    pub fn is_valid_sudoku(board: Vec<Vec<char>>) -> bool {
        let (mut rows, mut cols, mut boxes) = ([[false; 9]; 9], [[false; 9]; 9], [[false; 9]; 9]);
        for r in 0..9 {
            for c in 0..9 {
                let ch = board[r][c];
                if ch == '.' {
                    continue;
                }
                let v = ch as usize - '1' as usize;
                let b = (r / 3) * 3 + c / 3;
                if rows[r][v] || cols[c][v] || boxes[b][v] {
                    return false;
                }
                rows[r][v] = true;
                cols[c][v] = true;
                boxes[b][v] = true;
            }
        }
        true
    }
}
