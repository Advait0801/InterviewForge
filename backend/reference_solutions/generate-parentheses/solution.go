func generateParenthesis(n int) []string {
	out := []string{}
	var build func(s string, open, close int)
	build = func(s string, open, close int) {
		if len(s) == 2*n {
			out = append(out, s)
			return
		}
		if open < n {
			build(s+"(", open+1, close)
		}
		if close < open {
			build(s+")", open, close+1)
		}
	}
	build("", 0, 0)
	return out
}
