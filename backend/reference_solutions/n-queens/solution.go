func solveNQueens(n int) [][]string {
	out := [][]string{}
	cols := make([]int, n)
	used, d1, d2 := make([]bool, n), make([]bool, 2*n), make([]bool, 2*n)
	var place func(r int)
	place = func(r int) {
		if r == n {
			board := make([]string, n)
			for i, c := range cols {
				board[i] = strings.Repeat(".", c) + "Q" + strings.Repeat(".", n-c-1)
			}
			out = append(out, board)
			return
		}
		for c := 0; c < n; c++ {
			if used[c] || d1[r-c+n] || d2[r+c] {
				continue
			}
			used[c], d1[r-c+n], d2[r+c] = true, true, true
			cols[r] = c
			place(r + 1)
			used[c], d1[r-c+n], d2[r+c] = false, false, false
		}
	}
	place(0)
	return out
}
