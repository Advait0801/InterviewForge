func goodNodes(root *TreeNode) int {
	var count func(node *TreeNode, best int) int
	count = func(node *TreeNode, best int) int {
		if node == nil {
			return 0
		}
		good := 0
		if node.Val >= best {
			good = 1
		}
		best = max(best, node.Val)
		return good + count(node.Left, best) + count(node.Right, best)
	}
	return count(root, math.MinInt)
}
