impl Solution {
    pub fn min_window(s: String, t: String) -> String {
        let s: Vec<u8> = s.into_bytes();
        let mut need = [0i32; 128];
        let mut tracked = [false; 128];
        for b in t.bytes() {
            need[b as usize] += 1;
            tracked[b as usize] = true;
        }
        let (mut missing, mut start) = (t.len(), 0usize);
        let (mut best_start, mut best_len) = (0usize, usize::MAX);
        for end in 0..s.len() {
            let c = s[end] as usize;
            if tracked[c] {
                if need[c] > 0 {
                    missing -= 1;
                }
                need[c] -= 1;
            }
            while missing == 0 {
                if end - start + 1 < best_len {
                    best_start = start;
                    best_len = end - start + 1;
                }
                let d = s[start] as usize;
                if tracked[d] {
                    need[d] += 1;
                    if need[d] > 0 {
                        missing += 1;
                    }
                }
                start += 1;
            }
        }
        if best_len == usize::MAX {
            String::new()
        } else {
            String::from_utf8(s[best_start..best_start + best_len].to_vec()).unwrap()
        }
    }
}
