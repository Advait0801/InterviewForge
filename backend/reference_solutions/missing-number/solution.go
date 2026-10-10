func missingNumber(nums []int) int {
	x := len(nums)
	for i, v := range nums {
		x ^= i ^ v
	}
	return x
}
