func setZeroes(matrix [][]int) {
	rows, cols := map[int]bool{}, map[int]bool{}
	for r := range matrix {
		for c, v := range matrix[r] {
			if v == 0 {
				rows[r], cols[c] = true, true
			}
		}
	}
	for r := range matrix {
		for c := range matrix[r] {
			if rows[r] || cols[c] {
				matrix[r][c] = 0
			}
		}
	}
}
