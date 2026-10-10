func singleNumber(nums []int) int {
	x := 0
	for _, v := range nums {
		x ^= v
	}
	return x
}
