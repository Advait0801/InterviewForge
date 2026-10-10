impl Solution {
    pub fn is_match(s: String, p: String) -> bool {
        let (s, p) = (s.as_bytes(), p.as_bytes());
        let (m, n) = (s.len(), p.len());
        let mut dp = vec![vec![false; n + 1]; m + 1];
        dp[m][n] = true;
        for i in (0..=m).rev() {
            for j in (0..n).rev() {
                let first = i < m && (p[j] == s[i] || p[j] == b'.');
                dp[i][j] = if j + 1 < n && p[j + 1] == b'*' {
                    dp[i][j + 2] || (first && dp[i + 1][j])
                } else {
                    first && dp[i + 1][j + 1]
                };
            }
        }
        dp[0][0]
    }
}
