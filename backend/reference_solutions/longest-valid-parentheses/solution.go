func longestValidParentheses(s string) int {
	stack := []int{-1}
	best := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '(' {
			stack = append(stack, i)
			continue
		}
		stack = stack[:len(stack)-1]
		if len(stack) == 0 {
			stack = append(stack, i)
		} else {
			best = max(best, i-stack[len(stack)-1])
		}
	}
	return best
}
