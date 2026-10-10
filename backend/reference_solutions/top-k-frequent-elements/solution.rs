use std::collections::HashMap;

impl Solution {
    pub fn top_k_frequent(nums: Vec<i32>, k: i32) -> Vec<i32> {
        let mut count = HashMap::new();
        for x in nums {
            *count.entry(x).or_insert(0) += 1;
        }
        let mut pairs: Vec<(i32, i32)> = count.into_iter().collect();
        pairs.sort_by(|a, b| b.1.cmp(&a.1));
        pairs.into_iter().take(k as usize).map(|(x, _)| x).collect()
    }
}
