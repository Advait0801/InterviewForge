use std::collections::HashSet;

impl Solution {
    pub fn ladder_length(begin_word: String, end_word: String, word_list: Vec<String>) -> i32 {
        let mut words: HashSet<String> = word_list.into_iter().collect();
        if !words.contains(&end_word) {
            return 0;
        }
        words.remove(&begin_word);
        let (mut level, mut steps) = (vec![begin_word], 1);
        while !level.is_empty() {
            let mut next = vec![];
            for w in &level {
                if *w == end_word {
                    return steps;
                }
                let mut b = w.clone().into_bytes();
                for i in 0..b.len() {
                    let orig = b[i];
                    for c in b'a'..=b'z' {
                        b[i] = c;
                        let cand = String::from_utf8(b.clone()).unwrap();
                        if words.remove(&cand) {
                            next.push(cand);
                        }
                    }
                    b[i] = orig;
                }
            }
            level = next;
            steps += 1;
        }
        0
    }
}
