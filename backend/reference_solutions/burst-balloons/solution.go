func maxCoins(nums []int) int {
	a := append(append([]int{1}, nums...), 1)
	n := len(a)
	dp := make([][]int, n)
	for i := range dp {
		dp[i] = make([]int, n)
	}
	for length := 2; length < n; length++ {
		for l := 0; l+length < n; l++ {
			r := l + length
			for k := l + 1; k < r; k++ {
				dp[l][r] = max(dp[l][r], dp[l][k]+a[l]*a[k]*a[r]+dp[k][r])
			}
		}
	}
	return dp[0][n-1]
}
