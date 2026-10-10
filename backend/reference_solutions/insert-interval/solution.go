func insert(intervals [][]int, newInterval []int) [][]int {
	out := [][]int{}
	s, e, i := newInterval[0], newInterval[1], 0
	for i < len(intervals) && intervals[i][1] < s {
		out = append(out, intervals[i])
		i++
	}
	for i < len(intervals) && intervals[i][0] <= e {
		s, e = min(s, intervals[i][0]), max(e, intervals[i][1])
		i++
	}
	out = append(out, []int{s, e})
	return append(out, intervals[i:]...)
}
