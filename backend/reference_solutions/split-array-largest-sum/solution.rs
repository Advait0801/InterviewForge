impl Solution {
    pub fn split_array(nums: Vec<i32>, k: i32) -> i32 {
        let (mut lo, mut hi) = (*nums.iter().max().unwrap() as i64, nums.iter().map(|&x| x as i64).sum::<i64>());
        while lo < hi {
            let mid = (lo + hi) / 2;
            let (mut parts, mut sum) = (1, 0i64);
            for &x in &nums {
                if sum + x as i64 > mid {
                    parts += 1;
                    sum = 0;
                }
                sum += x as i64;
            }
            if parts <= k { hi = mid } else { lo = mid + 1 }
        }
        lo as i32
    }
}
