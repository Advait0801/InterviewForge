impl Solution {
    pub fn maximal_rectangle(matrix: Vec<Vec<char>>) -> i32 {
        if matrix.is_empty() {
            return 0;
        }
        let cols = matrix[0].len();
        let mut h = vec![0i32; cols];
        let mut best = 0;
        for row in &matrix {
            for c in 0..cols {
                h[c] = if row[c] == '1' { h[c] + 1 } else { 0 };
            }
            let mut stack: Vec<usize> = vec![];
            for i in 0..=cols {
                let cur = if i < cols { h[i] } else { 0 };
                while let Some(&top) = stack.last() {
                    if h[top] < cur {
                        break;
                    }
                    stack.pop();
                    let left = stack.last().map_or(0, |&l| l + 1);
                    best = best.max(h[top] * (i - left) as i32);
                }
                stack.push(i);
            }
        }
        best
    }
}
