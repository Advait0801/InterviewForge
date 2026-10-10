impl Solution {
    pub fn add_binary(a: String, b: String) -> String {
        let (a, b) = (a.as_bytes(), b.as_bytes());
        let (mut i, mut j, mut carry) = (a.len(), b.len(), 0);
        let mut out = vec![];
        while i > 0 || j > 0 || carry > 0 {
            let mut s = carry;
            if i > 0 {
                i -= 1;
                s += (a[i] - b'0') as u32;
            }
            if j > 0 {
                j -= 1;
                s += (b[j] - b'0') as u32;
            }
            out.push(if s % 2 == 1 { '1' } else { '0' });
            carry = s / 2;
        }
        out.iter().rev().collect()
    }
}
