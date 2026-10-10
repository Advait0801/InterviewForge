impl Solution {
    pub fn max_profit(prices: Vec<i32>) -> i32 {
        let (mut b1, mut s1, mut b2, mut s2) = (i32::MIN / 2, 0, i32::MIN / 2, 0);
        for p in prices {
            b1 = b1.max(-p);
            s1 = s1.max(b1 + p);
            b2 = b2.max(s1 - p);
            s2 = s2.max(b2 + p);
        }
        s2
    }
}
