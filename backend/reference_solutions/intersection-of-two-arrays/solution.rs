use std::collections::HashSet;

impl Solution {
    pub fn intersection(nums1: Vec<i32>, nums2: Vec<i32>) -> Vec<i32> {
        let a: HashSet<i32> = nums1.into_iter().collect();
        let b: HashSet<i32> = nums2.into_iter().collect();
        a.intersection(&b).copied().collect()
    }
}
