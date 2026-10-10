func floodFill(image [][]int, sr int, sc int, color int) [][]int {
	start := image[sr][sc]
	if start == color {
		return image
	}
	var fill func(r, c int)
	fill = func(r, c int) {
		if r < 0 || r >= len(image) || c < 0 || c >= len(image[0]) || image[r][c] != start {
			return
		}
		image[r][c] = color
		fill(r+1, c)
		fill(r-1, c)
		fill(r, c+1)
		fill(r, c-1)
	}
	fill(sr, sc)
	return image
}
