impl Solution {
    pub fn num_islands(mut grid: Vec<Vec<char>>) -> i32 {
        let (rows, cols) = (grid.len(), grid[0].len());
        let mut count = 0;
        for r in 0..rows {
            for c in 0..cols {
                if grid[r][c] != '1' {
                    continue;
                }
                count += 1;
                let mut stack = vec![(r, c)];
                grid[r][c] = '0';
                while let Some((y, x)) = stack.pop() {
                    let mut visit = |ny: usize, nx: usize, stack: &mut Vec<(usize, usize)>| {
                        if grid[ny][nx] == '1' {
                            grid[ny][nx] = '0';
                            stack.push((ny, nx));
                        }
                    };
                    if y > 0 { visit(y - 1, x, &mut stack); }
                    if y + 1 < rows { visit(y + 1, x, &mut stack); }
                    if x > 0 { visit(y, x - 1, &mut stack); }
                    if x + 1 < cols { visit(y, x + 1, &mut stack); }
                }
            }
        }
        count
    }
}
