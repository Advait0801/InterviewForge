func countDigitOne(n int) int {
	count := 0
	for f := 1; f <= n; f *= 10 {
		higher, cur, lower := n/(f*10), (n/f)%10, n%f
		switch {
		case cur == 0:
			count += higher * f
		case cur == 1:
			count += higher*f + lower + 1
		default:
			count += (higher + 1) * f
		}
	}
	return count
}
