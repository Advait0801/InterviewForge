impl Solution {
    pub fn cherry_pickup(grid: Vec<Vec<i32>>) -> i32 {
        // Two walkers from (0,0) to (n-1,n-1) at once; dp over step and both rows.
        let n = grid.len() as i32;
        const NEG: i32 = i32::MIN / 2;
        let mut dp = vec![vec![NEG; n as usize]; n as usize];
        dp[0][0] = grid[0][0];
        for step in 1..=2 * n - 2 {
            let mut next = vec![vec![NEG; n as usize]; n as usize];
            for r1 in (step - n + 1).max(0)..=step.min(n - 1) {
                for r2 in (step - n + 1).max(0)..=step.min(n - 1) {
                    let (c1, c2) = (step - r1, step - r2);
                    let (a, b) = (grid[r1 as usize][c1 as usize], grid[r2 as usize][c2 as usize]);
                    if a == -1 || b == -1 {
                        continue;
                    }
                    let mut best = NEG;
                    for pa in [r1, r1 - 1] {
                        for pb in [r2, r2 - 1] {
                            if pa >= 0 && pb >= 0 {
                                best = best.max(dp[pa as usize][pb as usize]);
                            }
                        }
                    }
                    if best == NEG {
                        continue;
                    }
                    next[r1 as usize][r2 as usize] = best + a + if r1 != r2 { b } else { 0 };
                }
            }
            dp = next;
        }
        dp[(n - 1) as usize][(n - 1) as usize].max(0)
    }
}
