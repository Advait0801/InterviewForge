func letterCombinations(digits string) []string {
	if digits == "" {
		return []string{}
	}
	keys := []string{"", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"}
	out := []string{""}
	for i := 0; i < len(digits); i++ {
		next := []string{}
		for _, p := range out {
			for _, c := range keys[digits[i]-'0'] {
				next = append(next, p+string(c))
			}
		}
		out = next
	}
	return out
}
