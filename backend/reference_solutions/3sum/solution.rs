impl Solution {
    pub fn three_sum(mut nums: Vec<i32>) -> Vec<Vec<i32>> {
        nums.sort();
        let n = nums.len();
        let mut out = vec![];
        for i in 0..n.saturating_sub(2) {
            if i > 0 && nums[i] == nums[i - 1] {
                continue;
            }
            let (mut lo, mut hi) = (i + 1, n - 1);
            while lo < hi {
                let sum = nums[i] + nums[lo] + nums[hi];
                if sum < 0 {
                    lo += 1;
                } else if sum > 0 {
                    hi -= 1;
                } else {
                    out.push(vec![nums[i], nums[lo], nums[hi]]);
                    while lo < hi && nums[lo] == nums[lo + 1] {
                        lo += 1;
                    }
                    while lo < hi && nums[hi] == nums[hi - 1] {
                        hi -= 1;
                    }
                    lo += 1;
                    hi -= 1;
                }
            }
        }
        out
    }
}
