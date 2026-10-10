func diameterOfBinaryTree(root *TreeNode) int {
	best := 0
	var depth func(*TreeNode) int
	depth = func(node *TreeNode) int {
		if node == nil {
			return 0
		}
		l, r := depth(node.Left), depth(node.Right)
		best = max(best, l+r)
		return 1 + max(l, r)
	}
	depth(root)
	return best
}
