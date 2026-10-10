func candy(ratings []int) int {
	n := len(ratings)
	c := make([]int, n)
	for i := range c {
		c[i] = 1
	}
	for i := 1; i < n; i++ {
		if ratings[i] > ratings[i-1] {
			c[i] = c[i-1] + 1
		}
	}
	for i := n - 2; i >= 0; i-- {
		if ratings[i] > ratings[i+1] {
			c[i] = max(c[i], c[i+1]+1)
		}
	}
	total := 0
	for _, x := range c {
		total += x
	}
	return total
}
