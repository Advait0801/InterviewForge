func wordBreak(s string, wordDict []string) bool {
	words := map[string]bool{}
	for _, w := range wordDict {
		words[w] = true
	}
	dp := make([]bool, len(s)+1)
	dp[0] = true
	for i := 1; i <= len(s); i++ {
		for j := 0; j < i && !dp[i]; j++ {
			dp[i] = dp[j] && words[s[j:i]]
		}
	}
	return dp[len(s)]
}
