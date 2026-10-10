impl Solution {
    pub fn rob(nums: Vec<i32>) -> i32 {
        let (mut take, mut skip) = (0, 0);
        for x in nums {
            let t = skip + x;
            skip = take.max(skip);
            take = t;
        }
        take.max(skip)
    }
}
