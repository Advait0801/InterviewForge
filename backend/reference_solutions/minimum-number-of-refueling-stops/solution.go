func minRefuelStops(target int, startFuel int, stations [][]int) int {
	// dp[i]: farthest reach with i stops.
	dp := make([]int, len(stations)+1)
	dp[0] = startFuel
	for i, st := range stations {
		for t := i; t >= 0; t-- {
			if dp[t] >= st[0] {
				dp[t+1] = max(dp[t+1], dp[t]+st[1])
			}
		}
	}
	for i, reach := range dp {
		if reach >= target {
			return i
		}
	}
	return -1
}
