func isHappy(n int) bool {
	seen := map[int]bool{}
	for n != 1 && !seen[n] {
		seen[n] = true
		next := 0
		for ; n > 0; n /= 10 {
			next += (n % 10) * (n % 10)
		}
		n = next
	}
	return n == 1
}
