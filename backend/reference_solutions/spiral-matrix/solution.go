func spiralOrder(matrix [][]int) []int {
	out := []int{}
	top, bottom, left, right := 0, len(matrix)-1, 0, len(matrix[0])-1
	for top <= bottom && left <= right {
		for c := left; c <= right; c++ {
			out = append(out, matrix[top][c])
		}
		for r := top + 1; r <= bottom; r++ {
			out = append(out, matrix[r][right])
		}
		if top < bottom && left < right {
			for c := right - 1; c >= left; c-- {
				out = append(out, matrix[bottom][c])
			}
			for r := bottom - 1; r > top; r-- {
				out = append(out, matrix[r][left])
			}
		}
		top, bottom, left, right = top+1, bottom-1, left+1, right-1
	}
	return out
}
