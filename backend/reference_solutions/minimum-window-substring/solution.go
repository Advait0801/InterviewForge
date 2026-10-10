func minWindow(s string, t string) string {
	need := map[byte]int{}
	for i := 0; i < len(t); i++ {
		need[t[i]]++
	}
	missing, start, bestStart, bestLen := len(t), 0, 0, math.MaxInt
	for end := 0; end < len(s); end++ {
		if cnt, ok := need[s[end]]; ok {
			if cnt > 0 {
				missing--
			}
			need[s[end]]--
		}
		for missing == 0 {
			if end-start+1 < bestLen {
				bestStart, bestLen = start, end-start+1
			}
			if _, ok := need[s[start]]; ok {
				need[s[start]]++
				if need[s[start]] > 0 {
					missing++
				}
			}
			start++
		}
	}
	if bestLen == math.MaxInt {
		return ""
	}
	return s[bestStart : bestStart+bestLen]
}
