use std::collections::HashSet;

impl Solution {
    pub fn longest_consecutive(nums: Vec<i32>) -> i32 {
        let set: HashSet<i64> = nums.into_iter().map(|x| x as i64).collect();
        let mut best = 0;
        for &x in &set {
            if set.contains(&(x - 1)) {
                continue;
            }
            let mut len = 1;
            while set.contains(&(x + len)) {
                len += 1;
            }
            best = best.max(len);
        }
        best as i32
    }
}
