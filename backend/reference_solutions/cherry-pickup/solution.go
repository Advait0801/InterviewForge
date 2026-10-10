func cherryPickup(grid [][]int) int {
	// Two walkers from (0,0) to (n-1,n-1) at once; dp over step and both rows.
	n := len(grid)
	const neg = math.MinInt / 2
	fresh := func() [][]int {
		d := make([][]int, n)
		for i := range d {
			d[i] = make([]int, n)
			for j := range d[i] {
				d[i][j] = neg
			}
		}
		return d
	}
	dp := fresh()
	dp[0][0] = grid[0][0]
	for step := 1; step <= 2*n-2; step++ {
		next := fresh()
		for r1 := max(0, step-n+1); r1 <= min(n-1, step); r1++ {
			for r2 := max(0, step-n+1); r2 <= min(n-1, step); r2++ {
				c1, c2 := step-r1, step-r2
				if grid[r1][c1] == -1 || grid[r2][c2] == -1 {
					continue
				}
				best := neg
				for _, a := range []int{r1, r1 - 1} {
					for _, b := range []int{r2, r2 - 1} {
						if a >= 0 && b >= 0 {
							best = max(best, dp[a][b])
						}
					}
				}
				if best == neg {
					continue
				}
				gain := grid[r1][c1]
				if r1 != r2 {
					gain += grid[r2][c2]
				}
				next[r1][r2] = best + gain
			}
		}
		dp = next
	}
	return max(0, dp[n-1][n-1])
}
