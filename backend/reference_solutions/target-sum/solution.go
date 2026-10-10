func findTargetSumWays(nums []int, target int) int {
	ways := map[int]int{0: 1}
	for _, x := range nums {
		next := map[int]int{}
		for s, w := range ways {
			next[s+x] += w
			next[s-x] += w
		}
		ways = next
	}
	return ways[target]
}
