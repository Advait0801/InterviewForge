type Codec struct{}

func Constructor() Codec {
	return Codec{}
}

// LeetCode's bracket format: "[1, 2, 3, null, null, 4, 5]", trailing nulls trimmed.
func (this *Codec) Serialize(root *TreeNode) string {
	if root == nil {
		return "[]"
	}
	out := []string{}
	queue := []*TreeNode{root}
	for i := 0; i < len(queue); i++ {
		node := queue[i]
		if node == nil {
			out = append(out, "null")
			continue
		}
		out = append(out, strconv.Itoa(node.Val))
		queue = append(queue, node.Left, node.Right)
	}
	for len(out) > 0 && out[len(out)-1] == "null" {
		out = out[:len(out)-1]
	}
	return "[" + strings.Join(out, ", ") + "]"
}

func (this *Codec) Deserialize(data string) *TreeNode {
	body := strings.TrimSpace(data)
	body = strings.TrimSpace(body[1 : len(body)-1])
	if body == "" {
		return nil
	}
	tokens := strings.Split(body, ",")
	node := func(t string) *TreeNode {
		t = strings.TrimSpace(t)
		if t == "null" {
			return nil
		}
		v, _ := strconv.Atoi(t)
		return &TreeNode{Val: v}
	}
	root := node(tokens[0])
	queue := []*TreeNode{root}
	i := 1
	for h := 0; h < len(queue) && i < len(tokens); h++ {
		cur := queue[h]
		if cur.Left = node(tokens[i]); cur.Left != nil {
			queue = append(queue, cur.Left)
		}
		i++
		if i < len(tokens) {
			if cur.Right = node(tokens[i]); cur.Right != nil {
				queue = append(queue, cur.Right)
			}
			i++
		}
	}
	return root
}
