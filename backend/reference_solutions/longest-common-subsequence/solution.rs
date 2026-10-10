impl Solution {
    pub fn longest_common_subsequence(text1: String, text2: String) -> i32 {
        let (a, b) = (text1.as_bytes(), text2.as_bytes());
        let mut prev = vec![0; b.len() + 1];
        for i in 1..=a.len() {
            let mut cur = vec![0; b.len() + 1];
            for j in 1..=b.len() {
                cur[j] = if a[i - 1] == b[j - 1] { prev[j - 1] + 1 } else { prev[j].max(cur[j - 1]) };
            }
            prev = cur;
        }
        prev[b.len()]
    }
}
