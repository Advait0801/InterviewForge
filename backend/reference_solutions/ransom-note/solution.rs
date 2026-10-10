impl Solution {
    pub fn can_construct(ransom_note: String, magazine: String) -> bool {
        let mut count = [0i32; 128];
        for b in magazine.bytes() {
            count[b as usize] += 1;
        }
        ransom_note.bytes().all(|b| {
            count[b as usize] -= 1;
            count[b as usize] >= 0
        })
    }
}
