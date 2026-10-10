func romanToInt(s string) int {
	v := map[byte]int{'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000}
	total := 0
	for i := 0; i < len(s); i++ {
		if i+1 < len(s) && v[s[i]] < v[s[i+1]] {
			total -= v[s[i]]
		} else {
			total += v[s[i]]
		}
	}
	return total
}
