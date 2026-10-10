impl Solution {
    pub fn min_cut(s: String) -> i32 {
        let b = s.as_bytes();
        let n = b.len() as i32;
        let mut cut: Vec<i32> = (0..=n).map(|i| i - 1).collect();
        for center in 0..n {
            for odd in 0..2 {
                let (mut l, mut r) = (center, center + odd);
                while l >= 0 && r < n && b[l as usize] == b[r as usize] {
                    cut[(r + 1) as usize] = cut[(r + 1) as usize].min(cut[l as usize] + 1);
                    l -= 1;
                    r += 1;
                }
            }
        }
        cut[n as usize]
    }
}
