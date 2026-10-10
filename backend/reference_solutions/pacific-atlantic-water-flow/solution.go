func pacificAtlantic(heights [][]int) [][]int {
	rows, cols := len(heights), len(heights[0])
	flood := func(starts [][2]int) [][]bool {
		seen := make([][]bool, rows)
		for r := range seen {
			seen[r] = make([]bool, cols)
		}
		stack := append([][2]int{}, starts...)
		for _, s := range starts {
			seen[s[0]][s[1]] = true
		}
		for len(stack) > 0 {
			p := stack[len(stack)-1]
			stack = stack[:len(stack)-1]
			for _, d := range [][2]int{{1, 0}, {-1, 0}, {0, 1}, {0, -1}} {
				r, c := p[0]+d[0], p[1]+d[1]
				if r >= 0 && r < rows && c >= 0 && c < cols && !seen[r][c] && heights[r][c] >= heights[p[0]][p[1]] {
					seen[r][c] = true
					stack = append(stack, [2]int{r, c})
				}
			}
		}
		return seen
	}
	pac, atl := [][2]int{}, [][2]int{}
	for r := 0; r < rows; r++ {
		pac = append(pac, [2]int{r, 0})
		atl = append(atl, [2]int{r, cols - 1})
	}
	for c := 0; c < cols; c++ {
		pac = append(pac, [2]int{0, c})
		atl = append(atl, [2]int{rows - 1, c})
	}
	p, a := flood(pac), flood(atl)
	out := [][]int{}
	for r := 0; r < rows; r++ {
		for c := 0; c < cols; c++ {
			if p[r][c] && a[r][c] {
				out = append(out, []int{r, c})
			}
		}
	}
	return out
}
