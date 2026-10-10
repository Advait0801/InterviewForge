func swimInWater(grid [][]int) int {
	n := len(grid)
	reachable := func(t int) bool {
		if grid[0][0] > t {
			return false
		}
		seen := make([][]bool, n)
		for i := range seen {
			seen[i] = make([]bool, n)
		}
		stack := [][2]int{{0, 0}}
		seen[0][0] = true
		for len(stack) > 0 {
			p := stack[len(stack)-1]
			stack = stack[:len(stack)-1]
			if p[0] == n-1 && p[1] == n-1 {
				return true
			}
			for _, d := range [][2]int{{1, 0}, {-1, 0}, {0, 1}, {0, -1}} {
				r, c := p[0]+d[0], p[1]+d[1]
				if r >= 0 && r < n && c >= 0 && c < n && !seen[r][c] && grid[r][c] <= t {
					seen[r][c] = true
					stack = append(stack, [2]int{r, c})
				}
			}
		}
		return false
	}
	return sort.Search(n*n, reachable)
}
