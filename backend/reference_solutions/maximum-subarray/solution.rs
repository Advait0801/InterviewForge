impl Solution {
    pub fn max_sub_array(nums: Vec<i32>) -> i32 {
        let (mut cur, mut best) = (nums[0], nums[0]);
        for &x in &nums[1..] {
            cur = x.max(cur + x);
            best = best.max(cur);
        }
        best
    }
}
