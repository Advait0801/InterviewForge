impl Solution {
    pub fn set_zeroes(matrix: &mut Vec<Vec<i32>>) {
        let (rows, cols) = (matrix.len(), matrix[0].len());
        let (mut zr, mut zc) = (vec![false; rows], vec![false; cols]);
        for r in 0..rows {
            for c in 0..cols {
                if matrix[r][c] == 0 {
                    zr[r] = true;
                    zc[c] = true;
                }
            }
        }
        for r in 0..rows {
            for c in 0..cols {
                if zr[r] || zc[c] {
                    matrix[r][c] = 0;
                }
            }
        }
    }
}
