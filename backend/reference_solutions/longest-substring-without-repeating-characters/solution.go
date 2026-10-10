func lengthOfLongestSubstring(s string) int {
	last := map[byte]int{}
	start, best := 0, 0
	for i := 0; i < len(s); i++ {
		if j, ok := last[s[i]]; ok && j >= start {
			start = j + 1
		}
		last[s[i]] = i
		best = max(best, i-start+1)
	}
	return best
}
