impl Solution {
    pub fn trap(height: Vec<i32>) -> i32 {
        if height.is_empty() {
            return 0;
        }
        let (mut lo, mut hi) = (0, height.len() - 1);
        let (mut left_max, mut right_max, mut water) = (0, 0, 0);
        while lo < hi {
            if height[lo] < height[hi] {
                left_max = left_max.max(height[lo]);
                water += left_max - height[lo];
                lo += 1;
            } else {
                right_max = right_max.max(height[hi]);
                water += right_max - height[hi];
                hi -= 1;
            }
        }
        water
    }
}
