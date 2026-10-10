impl Solution {
    pub fn solve_n_queens(n: i32) -> Vec<Vec<String>> {
        fn place(r: usize, n: usize, cols: &mut Vec<usize>, used: &mut [Vec<bool>; 3], out: &mut Vec<Vec<String>>) {
            if r == n {
                out.push(cols.iter().map(|&c| ".".repeat(c) + "Q" + &".".repeat(n - c - 1)).collect());
                return;
            }
            for c in 0..n {
                let (d1, d2) = (r + n - c, r + c);
                if used[0][c] || used[1][d1] || used[2][d2] {
                    continue;
                }
                used[0][c] = true;
                used[1][d1] = true;
                used[2][d2] = true;
                cols.push(c);
                place(r + 1, n, cols, used, out);
                cols.pop();
                used[0][c] = false;
                used[1][d1] = false;
                used[2][d2] = false;
            }
        }
        let n = n as usize;
        let mut out = vec![];
        let mut used = [vec![false; 2 * n], vec![false; 2 * n], vec![false; 2 * n]];
        place(0, n, &mut vec![], &mut used, &mut out);
        out
    }
}
