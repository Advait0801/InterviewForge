func findKthLargest(nums []int, k int) int {
	sorted := append([]int(nil), nums...)
	sort.Sort(sort.Reverse(sort.IntSlice(sorted)))
	return sorted[k-1]
}
