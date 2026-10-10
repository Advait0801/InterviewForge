impl Solution {
    pub fn change(amount: i32, coins: Vec<i32>) -> i32 {
        let amount = amount as usize;
        let mut ways = vec![0i64; amount + 1];
        ways[0] = 1;
        for c in coins {
            for a in c as usize..=amount {
                ways[a] = ways[a].wrapping_add(ways[a - c as usize]);
            }
        }
        ways[amount] as i32
    }
}
