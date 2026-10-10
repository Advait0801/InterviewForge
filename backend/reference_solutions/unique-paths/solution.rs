impl Solution {
    pub fn unique_paths(m: i32, n: i32) -> i32 {
        let mut row = vec![1i64; n as usize];
        for _ in 1..m {
            for c in 1..n as usize {
                row[c] += row[c - 1];
            }
        }
        row[n as usize - 1] as i32
    }
}
