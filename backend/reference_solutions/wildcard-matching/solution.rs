impl Solution {
    pub fn is_match(s: String, p: String) -> bool {
        let (s, p) = (s.as_bytes(), p.as_bytes());
        let n = p.len();
        let mut prev = vec![false; n + 1];
        prev[0] = true;
        for j in 1..=n {
            prev[j] = prev[j - 1] && p[j - 1] == b'*';
        }
        for i in 1..=s.len() {
            let mut cur = vec![false; n + 1];
            for j in 1..=n {
                cur[j] = if p[j - 1] == b'*' {
                    cur[j - 1] || prev[j]
                } else {
                    prev[j - 1] && (p[j - 1] == b'?' || p[j - 1] == s[i - 1])
                };
            }
            prev = cur;
        }
        prev[n]
    }
}
