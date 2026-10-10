func isBalanced(root *TreeNode) bool {
	// Height, or -1 once any subtree is unbalanced.
	var height func(*TreeNode) int
	height = func(node *TreeNode) int {
		if node == nil {
			return 0
		}
		l, r := height(node.Left), height(node.Right)
		if l < 0 || r < 0 || l-r > 1 || r-l > 1 {
			return -1
		}
		return 1 + max(l, r)
	}
	return height(root) >= 0
}
