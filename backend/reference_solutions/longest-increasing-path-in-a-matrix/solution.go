func longestIncreasingPath(matrix [][]int) int {
	rows, cols := len(matrix), len(matrix[0])
	memo := make([][]int, rows)
	for r := range memo {
		memo[r] = make([]int, cols)
	}
	var dfs func(r, c int) int
	dfs = func(r, c int) int {
		if memo[r][c] > 0 {
			return memo[r][c]
		}
		best := 1
		for _, d := range [][2]int{{1, 0}, {-1, 0}, {0, 1}, {0, -1}} {
			nr, nc := r+d[0], c+d[1]
			if nr >= 0 && nr < rows && nc >= 0 && nc < cols && matrix[nr][nc] > matrix[r][c] {
				best = max(best, 1+dfs(nr, nc))
			}
		}
		memo[r][c] = best
		return best
	}
	best := 0
	for r := 0; r < rows; r++ {
		for c := 0; c < cols; c++ {
			best = max(best, dfs(r, c))
		}
	}
	return best
}
