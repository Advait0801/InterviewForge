impl Solution {
    pub fn oranges_rotting(mut grid: Vec<Vec<i32>>) -> i32 {
        let (rows, cols) = (grid.len() as i32, grid[0].len() as i32);
        let mut queue = vec![];
        let mut fresh = 0;
        for r in 0..rows as usize {
            for c in 0..cols as usize {
                if grid[r][c] == 2 { queue.push((r as i32, c as i32)) } else if grid[r][c] == 1 { fresh += 1 }
            }
        }
        let mut minutes = 0;
        while !queue.is_empty() && fresh > 0 {
            let mut next = vec![];
            for (r, c) in queue {
                for (dr, dc) in [(1, 0), (-1, 0), (0, 1), (0, -1)] {
                    let (nr, nc) = (r + dr, c + dc);
                    if nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr as usize][nc as usize] == 1 {
                        grid[nr as usize][nc as usize] = 2;
                        fresh -= 1;
                        next.push((nr, nc));
                    }
                }
            }
            queue = next;
            minutes += 1;
        }
        if fresh > 0 { -1 } else { minutes }
    }
}
