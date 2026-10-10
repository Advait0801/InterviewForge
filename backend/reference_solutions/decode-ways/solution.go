func numDecodings(s string) int {
	prev, cur := 1, 0
	if s[0] != '0' {
		cur = 1
	}
	for i := 1; i < len(s); i++ {
		next := 0
		if s[i] != '0' {
			next = cur
		}
		if two := int(s[i-1]-'0')*10 + int(s[i]-'0'); two >= 10 && two <= 26 {
			next += prev
		}
		prev, cur = cur, next
	}
	return cur
}
