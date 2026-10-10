func maxProduct(nums []int) int {
	hi, lo, best := nums[0], nums[0], nums[0]
	for _, x := range nums[1:] {
		hi, lo = max(x, hi*x, lo*x), min(x, hi*x, lo*x)
		best = max(best, hi)
	}
	return best
}
