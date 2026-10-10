impl Solution {
    pub fn coin_change(coins: Vec<i32>, amount: i32) -> i32 {
        let amount = amount as usize;
        let mut dp = vec![i32::MAX; amount + 1];
        dp[0] = 0;
        for a in 1..=amount {
            for &c in &coins {
                let c = c as usize;
                if c <= a && dp[a - c] != i32::MAX {
                    dp[a] = dp[a].min(dp[a - c] + 1);
                }
            }
        }
        if dp[amount] == i32::MAX { -1 } else { dp[amount] }
    }
}
