func canPartition(nums []int) bool {
	total := 0
	for _, x := range nums {
		total += x
	}
	if total%2 == 1 {
		return false
	}
	half := total / 2
	can := make([]bool, half+1)
	can[0] = true
	for _, x := range nums {
		for s := half; s >= x; s-- {
			can[s] = can[s] || can[s-x]
		}
	}
	return can[half]
}
