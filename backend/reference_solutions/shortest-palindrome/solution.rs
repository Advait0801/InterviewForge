impl Solution {
    pub fn shortest_palindrome(s: String) -> String {
        // KMP failure function of s + "#" + reverse(s): the longest palindromic prefix.
        let rev: String = s.chars().rev().collect();
        let t: Vec<char> = format!("{}#{}", s, rev).chars().collect();
        let mut fail = vec![0usize; t.len()];
        for i in 1..t.len() {
            let mut j = fail[i - 1];
            while j > 0 && t[i] != t[j] {
                j = fail[j - 1];
            }
            if t[i] == t[j] {
                j += 1;
            }
            fail[i] = j;
        }
        let keep = s.chars().count() - fail[t.len() - 1];
        rev.chars().take(keep).collect::<String>() + &s
    }
}
