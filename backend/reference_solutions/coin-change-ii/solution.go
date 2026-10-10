func change(amount int, coins []int) int {
	ways := make([]int, amount+1)
	ways[0] = 1
	for _, c := range coins {
		for a := c; a <= amount; a++ {
			ways[a] += ways[a-c]
		}
	}
	return ways[amount]
}
