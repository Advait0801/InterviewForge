impl Solution {
    pub fn is_anagram(s: String, t: String) -> bool {
        let (mut a, mut b): (Vec<char>, Vec<char>) = (s.chars().collect(), t.chars().collect());
        a.sort_unstable();
        b.sort_unstable();
        a == b
    }
}
