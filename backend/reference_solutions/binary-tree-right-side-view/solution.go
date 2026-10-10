func rightSideView(root *TreeNode) []int {
	out := []int{}
	level := []*TreeNode{}
	if root != nil {
		level = append(level, root)
	}
	for len(level) > 0 {
		out = append(out, level[len(level)-1].Val)
		next := []*TreeNode{}
		for _, n := range level {
			if n.Left != nil {
				next = append(next, n.Left)
			}
			if n.Right != nil {
				next = append(next, n.Right)
			}
		}
		level = next
	}
	return out
}
