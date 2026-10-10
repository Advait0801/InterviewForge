impl Solution {
    pub fn rob(nums: Vec<i32>) -> i32 {
        fn line(a: &[i32]) -> i32 {
            let (mut take, mut skip) = (0, 0);
            for &x in a {
                let t = skip + x;
                skip = take.max(skip);
                take = t;
            }
            take.max(skip)
        }
        if nums.len() == 1 {
            return nums[0];
        }
        line(&nums[1..]).max(line(&nums[..nums.len() - 1]))
    }
}
