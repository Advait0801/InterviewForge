impl Solution {
    pub fn num_distinct(s: String, t: String) -> i32 {
        let t = t.as_bytes();
        let mut dp = vec![0u64; t.len() + 1];
        dp[0] = 1;
        for c in s.bytes() {
            for j in (1..=t.len()).rev() {
                if t[j - 1] == c {
                    dp[j] = dp[j].wrapping_add(dp[j - 1]);
                }
            }
        }
        dp[t.len()] as i32
    }
}
