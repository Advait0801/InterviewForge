func merge(intervals [][]int) [][]int {
	sort.Slice(intervals, func(i, j int) bool { return intervals[i][0] < intervals[j][0] })
	out := [][]int{}
	for _, iv := range intervals {
		if len(out) > 0 && iv[0] <= out[len(out)-1][1] {
			out[len(out)-1][1] = max(out[len(out)-1][1], iv[1])
		} else {
			out = append(out, []int{iv[0], iv[1]})
		}
	}
	return out
}
