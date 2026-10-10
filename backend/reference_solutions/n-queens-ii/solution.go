func totalNQueens(n int) int {
	var place func(r int, cols, d1, d2 uint) int
	place = func(r int, cols, d1, d2 uint) int {
		if r == n {
			return 1
		}
		count := 0
		for c := 0; c < n; c++ {
			a, b, d := uint(1)<<c, uint(1)<<(r+c), uint(1)<<(r-c+n)
			if cols&a != 0 || d1&b != 0 || d2&d != 0 {
				continue
			}
			count += place(r+1, cols|a, d1|b, d2|d)
		}
		return count
	}
	return place(0, 0, 0, 0)
}
