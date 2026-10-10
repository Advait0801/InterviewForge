impl Solution {
    pub fn generate(num_rows: i32) -> Vec<Vec<i32>> {
        let mut rows: Vec<Vec<i32>> = vec![];
        for r in 0..num_rows as usize {
            let mut row = vec![1; r + 1];
            for c in 1..r {
                row[c] = rows[r - 1][c - 1] + rows[r - 1][c];
            }
            rows.push(row);
        }
        rows
    }
}
