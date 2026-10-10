func canConstruct(ransomNote string, magazine string) bool {
	count := map[rune]int{}
	for _, c := range magazine {
		count[c]++
	}
	for _, c := range ransomNote {
		count[c]--
		if count[c] < 0 {
			return false
		}
	}
	return true
}
