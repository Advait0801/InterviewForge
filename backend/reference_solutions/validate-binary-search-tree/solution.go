func isValidBST(root *TreeNode) bool {
	var check func(node *TreeNode, lo, hi int) bool
	check = func(node *TreeNode, lo, hi int) bool {
		if node == nil {
			return true
		}
		return node.Val > lo && node.Val < hi && check(node.Left, lo, node.Val) && check(node.Right, node.Val, hi)
	}
	return check(root, math.MinInt, math.MaxInt)
}
