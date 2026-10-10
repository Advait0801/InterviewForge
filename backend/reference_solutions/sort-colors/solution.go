func sortColors(nums []int) {
	lo, mid, hi := 0, 0, len(nums)-1
	for mid <= hi {
		switch nums[mid] {
		case 0:
			nums[lo], nums[mid] = nums[mid], nums[lo]
			lo++
			mid++
		case 2:
			nums[mid], nums[hi] = nums[hi], nums[mid]
			hi--
		default:
			mid++
		}
	}
}
