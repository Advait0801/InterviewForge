func eraseOverlapIntervals(intervals [][]int) int {
	sort.Slice(intervals, func(i, j int) bool { return intervals[i][1] < intervals[j][1] })
	removed, end := 0, math.MinInt
	for _, iv := range intervals {
		if iv[0] >= end {
			end = iv[1]
		} else {
			removed++
		}
	}
	return removed
}
