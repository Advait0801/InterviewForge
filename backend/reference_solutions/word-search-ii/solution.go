type trieNode struct {
	next map[byte]*trieNode
	word string
}

func findWords(board [][]byte, words []string) []string {
	root := &trieNode{next: map[byte]*trieNode{}}
	for _, w := range words {
		node := root
		for i := 0; i < len(w); i++ {
			if node.next[w[i]] == nil {
				node.next[w[i]] = &trieNode{next: map[byte]*trieNode{}}
			}
			node = node.next[w[i]]
		}
		node.word = w
	}
	rows, cols := len(board), len(board[0])
	found := []string{}
	var dfs func(r, c int, parent *trieNode)
	dfs = func(r, c int, parent *trieNode) {
		ch := board[r][c]
		node := parent.next[ch]
		if node == nil {
			return
		}
		if node.word != "" {
			found = append(found, node.word)
			node.word = ""
		}
		board[r][c] = '#'
		for _, d := range [][2]int{{1, 0}, {-1, 0}, {0, 1}, {0, -1}} {
			nr, nc := r+d[0], c+d[1]
			if nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc] != '#' {
				dfs(nr, nc, node)
			}
		}
		board[r][c] = ch
	}
	for r := 0; r < rows; r++ {
		for c := 0; c < cols; c++ {
			dfs(r, c, root)
		}
	}
	return found
}
