func isValidSudoku(board [][]byte) bool {
	var rows, cols, boxes [9][9]bool
	for r := 0; r < 9; r++ {
		for c := 0; c < 9; c++ {
			if board[r][c] == '.' {
				continue
			}
			v, b := board[r][c]-'1', (r/3)*3+c/3
			if rows[r][v] || cols[c][v] || boxes[b][v] {
				return false
			}
			rows[r][v], cols[c][v], boxes[b][v] = true, true, true
		}
	}
	return true
}
