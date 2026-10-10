func coinChange(coins []int, amount int) int {
	dp := make([]int, amount+1)
	for a := 1; a <= amount; a++ {
		dp[a] = math.MaxInt32
		for _, c := range coins {
			if c <= a && dp[a-c]+1 < dp[a] {
				dp[a] = dp[a-c] + 1
			}
		}
	}
	if dp[amount] >= math.MaxInt32 {
		return -1
	}
	return dp[amount]
}
