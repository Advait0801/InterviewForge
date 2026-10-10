impl Solution {
    pub fn is_subsequence(s: String, t: String) -> bool {
        let mut it = t.chars();
        s.chars().all(|c| it.any(|d| d == c))
    }
}
