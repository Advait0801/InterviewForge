func buildTree(preorder []int, inorder []int) *TreeNode {
	index := map[int]int{}
	for i, v := range inorder {
		index[v] = i
	}
	p := 0
	var build func(lo, hi int) *TreeNode
	build = func(lo, hi int) *TreeNode {
		if lo > hi {
			return nil
		}
		root := &TreeNode{Val: preorder[p]}
		p++
		mid := index[root.Val]
		root.Left = build(lo, mid-1)
		root.Right = build(mid+1, hi)
		return root
	}
	return build(0, len(inorder)-1)
}
