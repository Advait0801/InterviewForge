impl Solution {
    pub fn island_perimeter(grid: Vec<Vec<i32>>) -> i32 {
        let mut p = 0;
        for r in 0..grid.len() {
            for c in 0..grid[0].len() {
                if grid[r][c] == 0 {
                    continue;
                }
                p += 4;
                if r > 0 && grid[r - 1][c] == 1 { p -= 2; }
                if c > 0 && grid[r][c - 1] == 1 { p -= 2; }
            }
        }
        p
    }
}
