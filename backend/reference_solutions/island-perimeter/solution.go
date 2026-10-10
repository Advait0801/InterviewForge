func islandPerimeter(grid [][]int) int {
	p := 0
	for r := range grid {
		for c := range grid[r] {
			if grid[r][c] == 0 {
				continue
			}
			p += 4
			if r > 0 && grid[r-1][c] == 1 {
				p -= 2
			}
			if c > 0 && grid[r][c-1] == 1 {
				p -= 2
			}
		}
	}
	return p
}
