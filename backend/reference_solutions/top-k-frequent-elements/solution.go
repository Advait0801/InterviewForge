func topKFrequent(nums []int, k int) []int {
	count := map[int]int{}
	for _, x := range nums {
		count[x]++
	}
	keys := make([]int, 0, len(count))
	for x := range count {
		keys = append(keys, x)
	}
	sort.Slice(keys, func(i, j int) bool { return count[keys[i]] > count[keys[j]] })
	return keys[:k]
}
