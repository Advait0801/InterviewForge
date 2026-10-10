func longestConsecutive(nums []int) int {
	set := map[int]bool{}
	for _, x := range nums {
		set[x] = true
	}
	best := 0
	for x := range set {
		if set[x-1] {
			continue
		}
		n := 1
		for set[x+n] {
			n++
		}
		best = max(best, n)
	}
	return best
}
