impl Solution {
    pub fn longest_common_prefix(strs: Vec<String>) -> String {
        let mut prefix = strs.first().cloned().unwrap_or_default();
        for s in &strs {
            while !s.starts_with(&prefix) {
                prefix.pop();
            }
        }
        prefix
    }
}
