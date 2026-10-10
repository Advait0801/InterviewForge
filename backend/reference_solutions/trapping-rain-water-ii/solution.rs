use std::cmp::Reverse;
use std::collections::BinaryHeap;

impl Solution {
    pub fn trap_rain_water(height_map: Vec<Vec<i32>>) -> i32 {
        let (rows, cols) = (height_map.len(), height_map[0].len());
        let mut seen = vec![vec![false; cols]; rows];
        let mut heap = BinaryHeap::new();
        for r in 0..rows {
            for c in 0..cols {
                if r == 0 || c == 0 || r == rows - 1 || c == cols - 1 {
                    heap.push(Reverse((height_map[r][c], r, c)));
                    seen[r][c] = true;
                }
            }
        }
        let mut water = 0;
        while let Some(Reverse((h, r, c))) = heap.pop() {
            let mut next = vec![];
            if r > 0 { next.push((r - 1, c)); }
            if r + 1 < rows { next.push((r + 1, c)); }
            if c > 0 { next.push((r, c - 1)); }
            if c + 1 < cols { next.push((r, c + 1)); }
            for (nr, nc) in next {
                if seen[nr][nc] {
                    continue;
                }
                seen[nr][nc] = true;
                water += (h - height_map[nr][nc]).max(0);
                heap.push(Reverse((h.max(height_map[nr][nc]), nr, nc)));
            }
        }
        water
    }
}
