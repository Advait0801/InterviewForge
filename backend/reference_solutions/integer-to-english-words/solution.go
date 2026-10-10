func numberToWords(num int) string {
	if num == 0 {
		return "Zero"
	}
	ones := []string{"", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven",
		"Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"}
	tens := []string{"", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"}
	chunk := func(n int) []string {
		words := []string{}
		if n >= 100 {
			words = append(words, ones[n/100], "Hundred")
			n %= 100
		}
		if n >= 20 {
			words = append(words, tens[n/10])
			n %= 10
		}
		if n > 0 {
			words = append(words, ones[n])
		}
		return words
	}
	words := []string{}
	scales := []struct {
		value int
		name  string
	}{{1_000_000_000, "Billion"}, {1_000_000, "Million"}, {1_000, "Thousand"}, {1, ""}}
	for _, sc := range scales {
		if part := (num / sc.value) % 1000; part > 0 {
			words = append(words, chunk(part)...)
			if sc.name != "" {
				words = append(words, sc.name)
			}
		}
	}
	return strings.Join(words, " ")
}
