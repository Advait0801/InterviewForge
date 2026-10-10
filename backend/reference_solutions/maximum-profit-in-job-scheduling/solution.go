func jobScheduling(startTime []int, endTime []int, profit []int) int {
	idx := make([]int, len(startTime))
	for i := range idx {
		idx[i] = i
	}
	sort.Slice(idx, func(a, b int) bool { return endTime[idx[a]] < endTime[idx[b]] })
	ends, best := []int{0}, []int{0}
	for _, i := range idx {
		// Last recorded job ending at or before this one starts.
		k := sort.Search(len(ends), func(x int) bool { return ends[x] > startTime[i] }) - 1
		if take := best[k] + profit[i]; take > best[len(best)-1] {
			ends = append(ends, endTime[i])
			best = append(best, take)
		}
	}
	return best[len(best)-1]
}
