func countBits(n int) []int {
	out := make([]int, n+1)
	for i := 1; i <= n; i++ {
		out[i] = out[i>>1] + i&1
	}
	return out
}
