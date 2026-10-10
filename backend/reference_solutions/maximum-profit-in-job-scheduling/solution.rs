impl Solution {
    pub fn job_scheduling(start_time: Vec<i32>, end_time: Vec<i32>, profit: Vec<i32>) -> i32 {
        let mut jobs: Vec<(i32, i32, i64)> = (0..start_time.len())
            .map(|i| (start_time[i], end_time[i], profit[i] as i64))
            .collect();
        jobs.sort_by_key(|j| j.1);
        let (mut ends, mut best) = (vec![0], vec![0i64]);
        for (s, e, p) in jobs {
            // Last recorded job ending at or before s.
            let k = ends.partition_point(|&x| x <= s) - 1;
            let take = best[k] + p;
            if take > *best.last().unwrap() {
                ends.push(e);
                best.push(take);
            }
        }
        *best.last().unwrap() as i32
    }
}
