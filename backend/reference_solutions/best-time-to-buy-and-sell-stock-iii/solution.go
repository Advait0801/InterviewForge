func maxProfit(prices []int) int {
	b1, s1, b2, s2 := math.MinInt/2, 0, math.MinInt/2, 0
	for _, p := range prices {
		b1 = max(b1, -p)
		s1 = max(s1, b1+p)
		b2 = max(b2, s1-p)
		s2 = max(s2, b2+p)
	}
	return s2
}
