impl Solution {
    pub fn count_digit_one(n: i32) -> i32 {
        let n = n as i64;
        let (mut count, mut f) = (0i64, 1i64);
        while f <= n {
            let (higher, cur, lower) = (n / (f * 10), (n / f) % 10, n % f);
            count += match cur {
                0 => higher * f,
                1 => higher * f + lower + 1,
                _ => (higher + 1) * f,
            };
            f *= 10;
        }
        count as i32
    }
}
