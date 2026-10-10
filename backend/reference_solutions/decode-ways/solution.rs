impl Solution {
    pub fn num_decodings(s: String) -> i32 {
        let b = s.as_bytes();
        let (mut prev, mut cur) = (1, if b[0] == b'0' { 0 } else { 1 });
        for i in 1..b.len() {
            let mut next = if b[i] != b'0' { cur } else { 0 };
            let two = (b[i - 1] - b'0') * 10 + (b[i] - b'0');
            if (10..=26).contains(&two) {
                next += prev;
            }
            prev = cur;
            cur = next;
        }
        cur
    }
}
