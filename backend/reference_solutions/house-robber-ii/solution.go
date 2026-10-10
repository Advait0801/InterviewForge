func rob(nums []int) int {
	if len(nums) == 1 {
		return nums[0]
	}
	line := func(a []int) int {
		take, skip := 0, 0
		for _, x := range a {
			take, skip = skip+x, max(take, skip)
		}
		return max(take, skip)
	}
	return max(line(nums[1:]), line(nums[:len(nums)-1]))
}
