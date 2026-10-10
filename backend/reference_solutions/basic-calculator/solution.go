func calculate(s string) int {
	result, sign, num := 0, 1, 0
	stack := []int{}
	for i := 0; i < len(s); i++ {
		switch ch := s[i]; {
		case ch >= '0' && ch <= '9':
			num = num*10 + int(ch-'0')
		case ch == '+' || ch == '-':
			result += sign * num
			num = 0
			sign = 1
			if ch == '-' {
				sign = -1
			}
		case ch == '(':
			stack = append(stack, result, sign)
			result, sign = 0, 1
		case ch == ')':
			result += sign * num
			num = 0
			prevSign, prevResult := stack[len(stack)-1], stack[len(stack)-2]
			stack = stack[:len(stack)-2]
			result = prevResult + prevSign*result
		}
	}
	return result + sign*num
}
