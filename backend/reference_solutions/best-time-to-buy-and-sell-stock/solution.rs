impl Solution {
    pub fn max_profit(prices: Vec<i32>) -> i32 {
        let (mut low, mut best) = (i32::MAX, 0);
        for p in prices {
            low = low.min(p);
            best = best.max(p - low);
        }
        best
    }
}
