func isPalindrome(s string) bool {
	t := []byte{}
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') {
			t = append(t, c)
		}
	}
	for i, j := 0, len(t)-1; i < j; i, j = i+1, j-1 {
		if t[i] != t[j] {
			return false
		}
	}
	return true
}
