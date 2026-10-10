impl Solution {
    pub fn my_sqrt(x: i32) -> i32 {
        let (mut lo, mut hi) = (0i64, x as i64);
        while lo < hi {
            let mid = (lo + hi + 1) / 2;
            if mid * mid <= x as i64 { lo = mid } else { hi = mid - 1 }
        }
        lo as i32
    }
}
