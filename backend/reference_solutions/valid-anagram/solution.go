func isAnagram(s string, t string) bool {
	if len(s) != len(t) {
		return false
	}
	count := map[rune]int{}
	for _, c := range s {
		count[c]++
	}
	for _, c := range t {
		count[c]--
		if count[c] < 0 {
			return false
		}
	}
	return true
}
