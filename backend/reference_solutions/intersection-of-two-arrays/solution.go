func intersection(nums1 []int, nums2 []int) []int {
	in1 := map[int]bool{}
	for _, x := range nums1 {
		in1[x] = true
	}
	out := []int{}
	for _, x := range nums2 {
		if in1[x] {
			out = append(out, x)
			in1[x] = false
		}
	}
	return out
}
