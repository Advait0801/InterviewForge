func numDistinct(s string, t string) int {
	dp := make([]int, len(t)+1)
	dp[0] = 1
	for i := 0; i < len(s); i++ {
		for j := len(t); j >= 1; j-- {
			if t[j-1] == s[i] {
				dp[j] += dp[j-1]
			}
		}
	}
	return dp[len(t)]
}
