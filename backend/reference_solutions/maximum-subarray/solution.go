func maxSubArray(nums []int) int {
	cur, best := nums[0], nums[0]
	for _, x := range nums[1:] {
		cur = max(x, cur+x)
		best = max(best, cur)
	}
	return best
}
