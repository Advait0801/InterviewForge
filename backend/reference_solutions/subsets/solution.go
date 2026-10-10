func subsets(nums []int) [][]int {
	out := [][]int{{}}
	for _, x := range nums {
		size := len(out)
		for i := 0; i < size; i++ {
			s := append(append([]int{}, out[i]...), x)
			out = append(out, s)
		}
	}
	return out
}
