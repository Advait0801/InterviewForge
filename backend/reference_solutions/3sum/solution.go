func threeSum(nums []int) [][]int {
	sort.Ints(nums)
	out := [][]int{}
	for i := 0; i+2 < len(nums); i++ {
		if i > 0 && nums[i] == nums[i-1] {
			continue
		}
		lo, hi := i+1, len(nums)-1
		for lo < hi {
			sum := nums[i] + nums[lo] + nums[hi]
			switch {
			case sum < 0:
				lo++
			case sum > 0:
				hi--
			default:
				out = append(out, []int{nums[i], nums[lo], nums[hi]})
				for lo < hi && nums[lo] == nums[lo+1] {
					lo++
				}
				for lo < hi && nums[hi] == nums[hi-1] {
					hi--
				}
				lo, hi = lo+1, hi-1
			}
		}
	}
	return out
}
