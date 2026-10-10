func getSkyline(buildings [][]int) [][]int {
	set := map[int]bool{}
	for _, b := range buildings {
		set[b[0]], set[b[1]] = true, true
	}
	xs := make([]int, 0, len(set))
	for x := range set {
		xs = append(xs, x)
	}
	sort.Ints(xs)
	out := [][]int{}
	prev := 0
	for _, x := range xs {
		h := 0
		for _, b := range buildings {
			if b[0] <= x && x < b[1] {
				h = max(h, b[2])
			}
		}
		if h != prev {
			out = append(out, []int{x, h})
			prev = h
		}
	}
	return out
}
