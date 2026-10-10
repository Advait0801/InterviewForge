func countSmaller(nums []int) []int {
	// Fenwick tree over value ranks, scanned right to left.
	sorted := append([]int(nil), nums...)
	sort.Ints(sorted)
	rank := map[int]int{}
	for _, v := range sorted {
		if _, ok := rank[v]; !ok {
			rank[v] = len(rank) + 1
		}
	}
	tree := make([]int, len(rank)+1)
	out := make([]int, len(nums))
	for i := len(nums) - 1; i >= 0; i-- {
		s := 0
		for r := rank[nums[i]] - 1; r > 0; r -= r & -r {
			s += tree[r]
		}
		out[i] = s
		for j := rank[nums[i]]; j < len(tree); j += j & -j {
			tree[j]++
		}
	}
	return out
}
