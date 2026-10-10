impl Solution {
    pub fn erase_overlap_intervals(mut intervals: Vec<Vec<i32>>) -> i32 {
        intervals.sort_by_key(|iv| iv[1]);
        let (mut removed, mut end) = (0, i64::MIN);
        for iv in intervals {
            if iv[0] as i64 >= end { end = iv[1] as i64 } else { removed += 1 }
        }
        removed
    }
}
