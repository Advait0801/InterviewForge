func lowestCommonAncestor(root *TreeNode, p *TreeNode, q *TreeNode) *TreeNode {
	for node := root; node != nil; {
		switch {
		case p.Val < node.Val && q.Val < node.Val:
			node = node.Left
		case p.Val > node.Val && q.Val > node.Val:
			node = node.Right
		default:
			return node
		}
	}
	return nil
}
