func leastInterval(tasks []byte, n int) int {
	count := [256]int{}
	top := 0
	for _, t := range tasks {
		count[t]++
		top = max(top, count[t])
	}
	atTop := 0
	for _, c := range count {
		if c == top {
			atTop++
		}
	}
	return max(len(tasks), (top-1)*(n+1)+atTop)
}
