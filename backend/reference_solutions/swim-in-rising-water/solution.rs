use std::cmp::Reverse;
use std::collections::BinaryHeap;

impl Solution {
    pub fn swim_in_water(grid: Vec<Vec<i32>>) -> i32 {
        // Dijkstra on the max elevation along the path.
        let n = grid.len();
        let mut seen = vec![vec![false; n]; n];
        let mut heap = BinaryHeap::from([Reverse((grid[0][0], 0usize, 0usize))]);
        while let Some(Reverse((t, r, c))) = heap.pop() {
            if seen[r][c] {
                continue;
            }
            seen[r][c] = true;
            if r == n - 1 && c == n - 1 {
                return t;
            }
            let mut next = vec![];
            if r > 0 { next.push((r - 1, c)); }
            if r + 1 < n { next.push((r + 1, c)); }
            if c > 0 { next.push((r, c - 1)); }
            if c + 1 < n { next.push((r, c + 1)); }
            for (nr, nc) in next {
                if !seen[nr][nc] {
                    heap.push(Reverse((t.max(grid[nr][nc]), nr, nc)));
                }
            }
        }
        -1
    }
}
