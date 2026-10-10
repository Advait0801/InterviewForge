impl Solution {
    pub fn missing_number(nums: Vec<i32>) -> i32 {
        let mut x = nums.len() as i32;
        for (i, v) in nums.iter().enumerate() {
            x ^= i as i32 ^ v;
        }
        x
    }
}
