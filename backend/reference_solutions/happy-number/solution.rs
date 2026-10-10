use std::collections::HashSet;

impl Solution {
    pub fn is_happy(mut n: i32) -> bool {
        let mut seen = HashSet::new();
        while n != 1 && seen.insert(n) {
            let mut next = 0;
            while n > 0 {
                next += (n % 10) * (n % 10);
                n /= 10;
            }
            n = next;
        }
        n == 1
    }
}
