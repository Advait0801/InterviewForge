func orangesRotting(grid [][]int) int {
	rows, cols := len(grid), len(grid[0])
	queue, fresh := [][2]int{}, 0
	for r := range grid {
		for c := range grid[r] {
			if grid[r][c] == 2 {
				queue = append(queue, [2]int{r, c})
			} else if grid[r][c] == 1 {
				fresh++
			}
		}
	}
	minutes := 0
	dirs := [][2]int{{1, 0}, {-1, 0}, {0, 1}, {0, -1}}
	for len(queue) > 0 && fresh > 0 {
		next := [][2]int{}
		for _, p := range queue {
			for _, d := range dirs {
				r, c := p[0]+d[0], p[1]+d[1]
				if r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c] == 1 {
					grid[r][c] = 2
					fresh--
					next = append(next, [2]int{r, c})
				}
			}
		}
		queue = next
		minutes++
	}
	if fresh > 0 {
		return -1
	}
	return minutes
}
