impl Solution {
    pub fn min_eating_speed(piles: Vec<i32>, h: i32) -> i32 {
        let (mut lo, mut hi) = (1i64, *piles.iter().max().unwrap() as i64);
        while lo < hi {
            let mid = (lo + hi) / 2;
            let hours: i64 = piles.iter().map(|&p| (p as i64 + mid - 1) / mid).sum();
            if hours <= h as i64 { hi = mid } else { lo = mid + 1 }
        }
        lo as i32
    }
}
