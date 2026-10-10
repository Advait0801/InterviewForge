impl Solution {
    pub fn count_substrings(s: String) -> i32 {
        let b = s.as_bytes();
        let n = b.len() as i32;
        let mut count = 0;
        for center in 0..2 * n - 1 {
            let (mut l, mut r) = (center / 2, center / 2 + center % 2);
            while l >= 0 && r < n && b[l as usize] == b[r as usize] {
                count += 1;
                l -= 1;
                r += 1;
            }
        }
        count
    }
}
