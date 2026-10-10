use std::collections::HashMap;

impl Solution {
    pub fn find_target_sum_ways(nums: Vec<i32>, target: i32) -> i32 {
        let mut ways: HashMap<i32, i32> = HashMap::from([(0, 1)]);
        for x in nums {
            let mut next = HashMap::new();
            for (s, w) in ways {
                *next.entry(s + x).or_insert(0) += w;
                *next.entry(s - x).or_insert(0) += w;
            }
            ways = next;
        }
        ways.get(&target).copied().unwrap_or(0)
    }
}
