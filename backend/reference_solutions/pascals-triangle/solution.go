func generate(numRows int) [][]int {
	rows := make([][]int, numRows)
	for r := range rows {
		rows[r] = make([]int, r+1)
		rows[r][0], rows[r][r] = 1, 1
		for c := 1; c < r; c++ {
			rows[r][c] = rows[r-1][c-1] + rows[r-1][c]
		}
	}
	return rows
}
