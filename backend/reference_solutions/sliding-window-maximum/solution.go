func maxSlidingWindow(nums []int, k int) []int {
	dq, out := []int{}, []int{}
	for i, x := range nums {
		for len(dq) > 0 && nums[dq[len(dq)-1]] <= x {
			dq = dq[:len(dq)-1]
		}
		dq = append(dq, i)
		if dq[0] <= i-k {
			dq = dq[1:]
		}
		if i >= k-1 {
			out = append(out, nums[dq[0]])
		}
	}
	return out
}
