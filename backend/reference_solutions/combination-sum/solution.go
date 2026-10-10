func combinationSum(candidates []int, target int) [][]int {
	sorted := append([]int(nil), candidates...)
	sort.Ints(sorted)
	out := [][]int{}
	cur := []int{}
	var dfs func(start, remaining int)
	dfs = func(start, remaining int) {
		if remaining == 0 {
			out = append(out, append([]int{}, cur...))
			return
		}
		for i := start; i < len(sorted) && sorted[i] <= remaining; i++ {
			cur = append(cur, sorted[i])
			dfs(i, remaining-sorted[i])
			cur = cur[:len(cur)-1]
		}
	}
	dfs(0, target)
	return out
}
