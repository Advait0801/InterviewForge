use std::collections::HashMap;

impl Solution {
    pub fn length_of_longest_substring(s: String) -> i32 {
        let mut last = HashMap::new();
        let (mut start, mut best) = (0usize, 0usize);
        for (i, c) in s.chars().enumerate() {
            if let Some(&j) = last.get(&c) {
                if j >= start {
                    start = j + 1;
                }
            }
            last.insert(c, i);
            best = best.max(i + 1 - start);
        }
        best as i32
    }
}
