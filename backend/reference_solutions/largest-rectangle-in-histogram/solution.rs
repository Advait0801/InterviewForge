impl Solution {
    pub fn largest_rectangle_area(heights: Vec<i32>) -> i32 {
        let mut stack: Vec<usize> = vec![];
        let mut best = 0;
        for i in 0..=heights.len() {
            let h = if i < heights.len() { heights[i] } else { 0 };
            while let Some(&top) = stack.last() {
                if heights[top] < h {
                    break;
                }
                stack.pop();
                let left = stack.last().map_or(0, |&l| l + 1);
                best = best.max(heights[top] * (i - left) as i32);
            }
            stack.push(i);
        }
        best
    }
}
