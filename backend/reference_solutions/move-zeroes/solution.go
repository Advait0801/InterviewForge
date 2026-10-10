func moveZeroes(nums []int) {
	w := 0
	for _, x := range nums {
		if x != 0 {
			nums[w] = x
			w++
		}
	}
	for ; w < len(nums); w++ {
		nums[w] = 0
	}
}
