impl Solution {
    pub fn search(nums: Vec<i32>, target: i32) -> i32 {
        let (mut lo, mut hi) = (0i32, nums.len() as i32 - 1);
        while lo <= hi {
            let mid = (lo + hi) / 2;
            let (l, m, h) = (nums[lo as usize], nums[mid as usize], nums[hi as usize]);
            if m == target {
                return mid;
            }
            if l <= m {
                if l <= target && target < m { hi = mid - 1 } else { lo = mid + 1 }
            } else if m < target && target <= h {
                lo = mid + 1
            } else {
                hi = mid - 1
            }
        }
        -1
    }
}
