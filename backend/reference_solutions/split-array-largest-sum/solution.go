func splitArray(nums []int, k int) int {
	lo, hi := 0, 0
	for _, x := range nums {
		lo = max(lo, x)
		hi += x
	}
	for lo < hi {
		mid := (lo + hi) / 2
		parts, sum := 1, 0
		for _, x := range nums {
			if sum+x > mid {
				parts++
				sum = 0
			}
			sum += x
		}
		if parts <= k {
			hi = mid
		} else {
			lo = mid + 1
		}
	}
	return lo
}
