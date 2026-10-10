func maxProfit(k int, prices []int) int {
	buy, sell := make([]int, k+1), make([]int, k+1)
	for j := range buy {
		buy[j] = math.MinInt / 2
	}
	for _, p := range prices {
		for j := 1; j <= k; j++ {
			buy[j] = max(buy[j], sell[j-1]-p)
			sell[j] = max(sell[j], buy[j]+p)
		}
	}
	return sell[k]
}
