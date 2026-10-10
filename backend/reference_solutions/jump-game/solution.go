func canJump(nums []int) bool {
	reach := 0
	for i, x := range nums {
		if i > reach {
			return false
		}
		reach = max(reach, i+x)
	}
	return true
}
