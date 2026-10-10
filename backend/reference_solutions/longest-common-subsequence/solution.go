func longestCommonSubsequence(text1 string, text2 string) int {
	n := len(text2)
	prev := make([]int, n+1)
	for i := 1; i <= len(text1); i++ {
		cur := make([]int, n+1)
		for j := 1; j <= n; j++ {
			if text1[i-1] == text2[j-1] {
				cur[j] = prev[j-1] + 1
			} else {
				cur[j] = max(prev[j], cur[j-1])
			}
		}
		prev = cur
	}
	return prev[n]
}
