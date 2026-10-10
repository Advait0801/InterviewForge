func countSubstrings(s string) int {
	count := 0
	for center := 0; center < 2*len(s)-1; center++ {
		l, r := center/2, center/2+center%2
		for l >= 0 && r < len(s) && s[l] == s[r] {
			count++
			l--
			r++
		}
	}
	return count
}
