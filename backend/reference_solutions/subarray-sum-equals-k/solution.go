func subarraySum(nums []int, k int) int {
	prefix := map[int]int{0: 1}
	sum, count := 0, 0
	for _, x := range nums {
		sum += x
		count += prefix[sum-k]
		prefix[sum]++
	}
	return count
}
