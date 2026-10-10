impl Solution {
    pub fn product_except_self(nums: Vec<i32>) -> Vec<i32> {
        let n = nums.len();
        let mut out = vec![1; n];
        let mut left = 1;
        for i in 0..n {
            out[i] = left;
            left *= nums[i];
        }
        let mut right = 1;
        for i in (0..n).rev() {
            out[i] *= right;
            right *= nums[i];
        }
        out
    }
}
