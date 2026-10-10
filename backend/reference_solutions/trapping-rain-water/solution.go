func trap(height []int) int {
	lo, hi, leftMax, rightMax, water := 0, len(height)-1, 0, 0, 0
	for lo < hi {
		if height[lo] < height[hi] {
			leftMax = max(leftMax, height[lo])
			water += leftMax - height[lo]
			lo++
		} else {
			rightMax = max(rightMax, height[hi])
			water += rightMax - height[hi]
			hi--
		}
	}
	return water
}
