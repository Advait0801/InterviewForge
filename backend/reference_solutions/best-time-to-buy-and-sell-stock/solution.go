func maxProfit(prices []int) int {
	low, best := math.MaxInt, 0
	for _, p := range prices {
		low = min(low, p)
		best = max(best, p-low)
	}
	return best
}
