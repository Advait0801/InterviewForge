func uniquePaths(m int, n int) int {
	row := make([]int, n)
	for c := range row {
		row[c] = 1
	}
	for r := 1; r < m; r++ {
		for c := 1; c < n; c++ {
			row[c] += row[c-1]
		}
	}
	return row[n-1]
}
