func maxPathSum(root *TreeNode) int {
	best := math.MinInt
	var gain func(*TreeNode) int
	gain = func(node *TreeNode) int {
		if node == nil {
			return 0
		}
		l, r := max(0, gain(node.Left)), max(0, gain(node.Right))
		best = max(best, node.Val+l+r)
		return node.Val + max(l, r)
	}
	gain(root)
	return best
}
