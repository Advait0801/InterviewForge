impl Solution {
    pub fn max_profit(k: i32, prices: Vec<i32>) -> i32 {
        let k = k as usize;
        let (mut buy, mut sell) = (vec![i32::MIN / 2; k + 1], vec![0; k + 1]);
        for p in prices {
            for j in 1..=k {
                buy[j] = buy[j].max(sell[j - 1] - p);
                sell[j] = sell[j].max(buy[j] + p);
            }
        }
        sell[k]
    }
}
