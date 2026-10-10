func evalRPN(tokens []string) int {
	stack := []int{}
	for _, t := range tokens {
		if len(t) == 1 && strings.Contains("+-*/", t) {
			b, a := stack[len(stack)-1], stack[len(stack)-2]
			stack = stack[:len(stack)-2]
			switch t {
			case "+":
				stack = append(stack, a+b)
			case "-":
				stack = append(stack, a-b)
			case "*":
				stack = append(stack, a*b)
			default:
				stack = append(stack, a/b) // Go truncates toward zero
			}
			continue
		}
		v, _ := strconv.Atoi(t)
		stack = append(stack, v)
	}
	return stack[0]
}
