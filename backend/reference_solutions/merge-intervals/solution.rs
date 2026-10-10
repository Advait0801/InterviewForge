impl Solution {
    pub fn merge(mut intervals: Vec<Vec<i32>>) -> Vec<Vec<i32>> {
        intervals.sort_by_key(|iv| iv[0]);
        let mut out: Vec<Vec<i32>> = vec![];
        for iv in intervals {
            match out.last_mut() {
                Some(last) if iv[0] <= last[1] => last[1] = last[1].max(iv[1]),
                _ => out.push(iv),
            }
        }
        out
    }
}
