impl Solution {
    pub fn roman_to_int(s: String) -> i32 {
        let v = |c: char| match c {
            'I' => 1, 'V' => 5, 'X' => 10, 'L' => 50, 'C' => 100, 'D' => 500, _ => 1000,
        };
        let chars: Vec<char> = s.chars().collect();
        let mut total = 0;
        for i in 0..chars.len() {
            if i + 1 < chars.len() && v(chars[i]) < v(chars[i + 1]) {
                total -= v(chars[i]);
            } else {
                total += v(chars[i]);
            }
        }
        total
    }
}
