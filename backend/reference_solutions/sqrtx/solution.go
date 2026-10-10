func mySqrt(x int) int {
	lo, hi := 0, x
	for lo < hi {
		mid := (lo + hi + 1) / 2
		if mid*mid <= x {
			lo = mid
		} else {
			hi = mid - 1
		}
	}
	return lo
}
