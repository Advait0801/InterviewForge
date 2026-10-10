func maxPoints(points [][]int) int {
	gcd := func(a, b int) int {
		for b != 0 {
			a, b = b, a%b
		}
		if a < 0 {
			return -a
		}
		return a
	}
	best := min(len(points), 1)
	for i := range points {
		slopes := map[[2]int]int{}
		for j := i + 1; j < len(points); j++ {
			dx, dy := points[j][0]-points[i][0], points[j][1]-points[i][1]
			g := gcd(dx, dy)
			dx, dy = dx/g, dy/g
			if dx < 0 || (dx == 0 && dy < 0) {
				dx, dy = -dx, -dy
			}
			key := [2]int{dx, dy}
			if slopes[key] == 0 {
				slopes[key] = 1
			}
			slopes[key]++
			best = max(best, slopes[key])
		}
	}
	return best
}
