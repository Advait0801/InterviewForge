impl Solution {
    pub fn pacific_atlantic(heights: Vec<Vec<i32>>) -> Vec<Vec<i32>> {
        let (rows, cols) = (heights.len(), heights[0].len());
        let flood = |starts: Vec<(usize, usize)>| {
            let mut seen = vec![vec![false; cols]; rows];
            for &(r, c) in &starts {
                seen[r][c] = true;
            }
            let mut stack = starts;
            while let Some((r, c)) = stack.pop() {
                let mut next = vec![];
                if r > 0 { next.push((r - 1, c)); }
                if r + 1 < rows { next.push((r + 1, c)); }
                if c > 0 { next.push((r, c - 1)); }
                if c + 1 < cols { next.push((r, c + 1)); }
                for (nr, nc) in next {
                    if !seen[nr][nc] && heights[nr][nc] >= heights[r][c] {
                        seen[nr][nc] = true;
                        stack.push((nr, nc));
                    }
                }
            }
            seen
        };
        let mut pac: Vec<(usize, usize)> = (0..rows).map(|r| (r, 0)).collect();
        pac.extend((0..cols).map(|c| (0, c)));
        let mut atl: Vec<(usize, usize)> = (0..rows).map(|r| (r, cols - 1)).collect();
        atl.extend((0..cols).map(|c| (rows - 1, c)));
        let (p, a) = (flood(pac), flood(atl));
        let mut out = vec![];
        for r in 0..rows {
            for c in 0..cols {
                if p[r][c] && a[r][c] {
                    out.push(vec![r as i32, c as i32]);
                }
            }
        }
        out
    }
}
