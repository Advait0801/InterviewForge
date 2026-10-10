func rob(nums []int) int {
	take, skip := 0, 0
	for _, x := range nums {
		take, skip = skip+x, max(take, skip)
	}
	return max(take, skip)
}
