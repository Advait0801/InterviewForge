func shortestPalindrome(s string) string {
	// KMP failure function of s + "#" + reverse(s): the longest palindromic prefix.
	b := []byte(s)
	for i, j := 0, len(b)-1; i < j; i, j = i+1, j-1 {
		b[i], b[j] = b[j], b[i]
	}
	rev := string(b)
	t := s + "#" + rev
	fail := make([]int, len(t))
	for i := 1; i < len(t); i++ {
		j := fail[i-1]
		for j > 0 && t[i] != t[j] {
			j = fail[j-1]
		}
		if t[i] == t[j] {
			j++
		}
		fail[i] = j
	}
	return rev[:len(s)-fail[len(t)-1]] + s
}
