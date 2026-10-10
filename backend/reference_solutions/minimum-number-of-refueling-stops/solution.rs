impl Solution {
    pub fn min_refuel_stops(target: i32, start_fuel: i32, stations: Vec<Vec<i32>>) -> i32 {
        // dp[i]: farthest reach with i stops.
        let mut dp = vec![0i64; stations.len() + 1];
        dp[0] = start_fuel as i64;
        for (i, st) in stations.iter().enumerate() {
            for t in (0..=i).rev() {
                if dp[t] >= st[0] as i64 {
                    dp[t + 1] = dp[t + 1].max(dp[t] + st[1] as i64);
                }
            }
        }
        dp.iter().position(|&reach| reach >= target as i64).map_or(-1, |i| i as i32)
    }
}
