use std::collections::HashMap;

impl Solution {
    pub fn subarray_sum(nums: Vec<i32>, k: i32) -> i32 {
        let mut prefix: HashMap<i64, i32> = HashMap::from([(0, 1)]);
        let (mut sum, mut count) = (0i64, 0);
        for x in nums {
            sum += x as i64;
            count += prefix.get(&(sum - k as i64)).copied().unwrap_or(0);
            *prefix.entry(sum).or_insert(0) += 1;
        }
        count
    }
}
