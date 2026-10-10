func levelOrder(root *TreeNode) [][]int {
	out := [][]int{}
	level := []*TreeNode{}
	if root != nil {
		level = append(level, root)
	}
	for len(level) > 0 {
		vals, next := []int{}, []*TreeNode{}
		for _, n := range level {
			vals = append(vals, n.Val)
			if n.Left != nil {
				next = append(next, n.Left)
			}
			if n.Right != nil {
				next = append(next, n.Right)
			}
		}
		out = append(out, vals)
		level = next
	}
	return out
}
