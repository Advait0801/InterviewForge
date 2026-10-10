impl Solution {
    pub fn insert(intervals: Vec<Vec<i32>>, new_interval: Vec<i32>) -> Vec<Vec<i32>> {
        let (mut s, mut e) = (new_interval[0], new_interval[1]);
        let mut out = vec![];
        let mut i = 0;
        while i < intervals.len() && intervals[i][1] < s {
            out.push(intervals[i].clone());
            i += 1;
        }
        while i < intervals.len() && intervals[i][0] <= e {
            s = s.min(intervals[i][0]);
            e = e.max(intervals[i][1]);
            i += 1;
        }
        out.push(vec![s, e]);
        out.extend_from_slice(&intervals[i..]);
        out
    }
}
