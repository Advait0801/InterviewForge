func minEatingSpeed(piles []int, h int) int {
	lo, hi := 1, 0
	for _, p := range piles {
		hi = max(hi, p)
	}
	for lo < hi {
		mid := (lo + hi) / 2
		hours := 0
		for _, p := range piles {
			hours += (p + mid - 1) / mid
		}
		if hours <= h {
			hi = mid
		} else {
			lo = mid + 1
		}
	}
	return lo
}
