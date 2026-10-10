impl Solution {
    pub fn sort_colors(nums: &mut Vec<i32>) {
        let (mut lo, mut mid, mut hi) = (0usize, 0usize, nums.len());
        while mid < hi {
            match nums[mid] {
                0 => {
                    nums.swap(lo, mid);
                    lo += 1;
                    mid += 1;
                }
                2 => {
                    hi -= 1;
                    nums.swap(mid, hi);
                }
                _ => mid += 1,
            }
        }
    }
}
