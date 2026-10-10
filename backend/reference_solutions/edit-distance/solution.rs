impl Solution {
    pub fn min_distance(word1: String, word2: String) -> i32 {
        let (a, b): (Vec<char>, Vec<char>) = (word1.chars().collect(), word2.chars().collect());
        let mut prev: Vec<i32> = (0..=b.len() as i32).collect();
        for i in 1..=a.len() {
            let mut cur = vec![i as i32; b.len() + 1];
            for j in 1..=b.len() {
                cur[j] = if a[i - 1] == b[j - 1] {
                    prev[j - 1]
                } else {
                    1 + prev[j - 1].min(prev[j]).min(cur[j - 1])
                };
            }
            prev = cur;
        }
        prev[b.len()]
    }
}
