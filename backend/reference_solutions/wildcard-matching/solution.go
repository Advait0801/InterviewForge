func isMatch(s string, p string) bool {
	m, n := len(s), len(p)
	prev := make([]bool, n+1)
	prev[0] = true
	for j := 1; j <= n; j++ {
		prev[j] = prev[j-1] && p[j-1] == '*'
	}
	for i := 1; i <= m; i++ {
		cur := make([]bool, n+1)
		for j := 1; j <= n; j++ {
			if p[j-1] == '*' {
				cur[j] = cur[j-1] || prev[j]
			} else {
				cur[j] = prev[j-1] && (p[j-1] == '?' || p[j-1] == s[i-1])
			}
		}
		prev = cur
	}
	return prev[n]
}
