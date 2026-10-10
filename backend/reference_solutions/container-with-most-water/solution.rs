impl Solution {
    pub fn max_area(height: Vec<i32>) -> i32 {
        let (mut lo, mut hi, mut best) = (0, height.len() - 1, 0);
        while lo < hi {
            best = best.max((hi - lo) as i32 * height[lo].min(height[hi]));
            if height[lo] < height[hi] { lo += 1 } else { hi -= 1 }
        }
        best
    }
}
