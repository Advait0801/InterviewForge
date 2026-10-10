func maximalRectangle(matrix [][]byte) int {
	if len(matrix) == 0 {
		return 0
	}
	cols := len(matrix[0])
	h := make([]int, cols)
	best := 0
	for _, row := range matrix {
		for c := 0; c < cols; c++ {
			if row[c] == '1' {
				h[c]++
			} else {
				h[c] = 0
			}
		}
		stack := []int{}
		for i := 0; i <= cols; i++ {
			cur := 0
			if i < cols {
				cur = h[i]
			}
			for len(stack) > 0 && h[stack[len(stack)-1]] >= cur {
				height := h[stack[len(stack)-1]]
				stack = stack[:len(stack)-1]
				left := 0
				if len(stack) > 0 {
					left = stack[len(stack)-1] + 1
				}
				best = max(best, height*(i-left))
			}
			stack = append(stack, i)
		}
	}
	return best
}
