func largestRectangleArea(heights []int) int {
	stack := []int{}
	best := 0
	for i := 0; i <= len(heights); i++ {
		h := 0
		if i < len(heights) {
			h = heights[i]
		}
		for len(stack) > 0 && heights[stack[len(stack)-1]] >= h {
			top := heights[stack[len(stack)-1]]
			stack = stack[:len(stack)-1]
			left := 0
			if len(stack) > 0 {
				left = stack[len(stack)-1] + 1
			}
			best = max(best, top*(i-left))
		}
		stack = append(stack, i)
	}
	return best
}
