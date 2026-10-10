func minCut(s string) int {
	n := len(s)
	cut := make([]int, n+1)
	for i := range cut {
		cut[i] = i - 1
	}
	for center := 0; center < n; center++ {
		for odd := 0; odd <= 1; odd++ {
			for l, r := center, center+odd; l >= 0 && r < n && s[l] == s[r]; l, r = l-1, r+1 {
				cut[r+1] = min(cut[r+1], cut[l]+1)
			}
		}
	}
	return cut[n]
}
