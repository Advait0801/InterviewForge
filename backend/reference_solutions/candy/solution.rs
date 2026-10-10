impl Solution {
    pub fn candy(ratings: Vec<i32>) -> i32 {
        let n = ratings.len();
        let mut c = vec![1; n];
        for i in 1..n {
            if ratings[i] > ratings[i - 1] {
                c[i] = c[i - 1] + 1;
            }
        }
        for i in (0..n.saturating_sub(1)).rev() {
            if ratings[i] > ratings[i + 1] {
                c[i] = c[i].max(c[i + 1] + 1);
            }
        }
        c.iter().sum()
    }
}
