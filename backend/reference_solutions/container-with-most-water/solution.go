func maxArea(height []int) int {
	lo, hi, best := 0, len(height)-1, 0
	for lo < hi {
		best = max(best, (hi-lo)*min(height[lo], height[hi]))
		if height[lo] < height[hi] {
			lo++
		} else {
			hi--
		}
	}
	return best
}
