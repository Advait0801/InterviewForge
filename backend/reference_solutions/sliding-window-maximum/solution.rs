use std::collections::VecDeque;

impl Solution {
    pub fn max_sliding_window(nums: Vec<i32>, k: i32) -> Vec<i32> {
        let k = k as usize;
        let (mut dq, mut out) = (VecDeque::new(), vec![]);
        for i in 0..nums.len() {
            while dq.back().map_or(false, |&j| nums[j] <= nums[i]) {
                dq.pop_back();
            }
            dq.push_back(i);
            if dq[0] + k <= i {
                dq.pop_front();
            }
            if i + 1 >= k {
                out.push(nums[dq[0]]);
            }
        }
        out
    }
}
