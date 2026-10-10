impl Solution {
    pub fn can_jump(nums: Vec<i32>) -> bool {
        let mut reach = 0usize;
        for (i, &x) in nums.iter().enumerate() {
            if i > reach {
                return false;
            }
            reach = reach.max(i + x as usize);
        }
        true
    }
}
