impl Solution {
    pub fn letter_combinations(digits: String) -> Vec<String> {
        if digits.is_empty() {
            return vec![];
        }
        let keys = ["", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"];
        let mut out = vec![String::new()];
        for d in digits.bytes() {
            out = out
                .iter()
                .flat_map(|p| keys[(d - b'0') as usize].chars().map(move |c| format!("{}{}", p, c)))
                .collect();
        }
        out
    }
}
