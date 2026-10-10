impl Solution {
    pub fn total_n_queens(n: i32) -> i32 {
        fn place(r: i32, n: i32, cols: u32, d1: u32, d2: u32) -> i32 {
            if r == n {
                return 1;
            }
            let mut count = 0;
            for c in 0..n {
                let (a, b, d) = (1u32 << c, 1u32 << (r + c), 1u32 << (r - c + n));
                if cols & a != 0 || d1 & b != 0 || d2 & d != 0 {
                    continue;
                }
                count += place(r + 1, n, cols | a, d1 | b, d2 | d);
            }
            count
        }
        place(0, n, 0, 0, 0)
    }
}
