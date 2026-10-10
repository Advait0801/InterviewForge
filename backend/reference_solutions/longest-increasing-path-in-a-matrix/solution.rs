impl Solution {
    pub fn longest_increasing_path(matrix: Vec<Vec<i32>>) -> i32 {
        fn dfs(m: &Vec<Vec<i32>>, memo: &mut Vec<Vec<i32>>, r: usize, c: usize) -> i32 {
            if memo[r][c] > 0 {
                return memo[r][c];
            }
            let mut best = 1;
            let mut next = vec![];
            if r > 0 { next.push((r - 1, c)); }
            if r + 1 < m.len() { next.push((r + 1, c)); }
            if c > 0 { next.push((r, c - 1)); }
            if c + 1 < m[0].len() { next.push((r, c + 1)); }
            for (nr, nc) in next {
                if m[nr][nc] > m[r][c] {
                    best = best.max(1 + dfs(m, memo, nr, nc));
                }
            }
            memo[r][c] = best;
            best
        }
        let mut memo = vec![vec![0; matrix[0].len()]; matrix.len()];
        let mut best = 0;
        for r in 0..matrix.len() {
            for c in 0..matrix[0].len() {
                best = best.max(dfs(&matrix, &mut memo, r, c));
            }
        }
        best
    }
}
