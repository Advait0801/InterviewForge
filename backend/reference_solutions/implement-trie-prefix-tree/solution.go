type Trie struct {
	children [26]*Trie
	end      bool
}

func Constructor() Trie {
	return Trie{}
}

func (this *Trie) Insert(word string) {
	node := this
	for i := 0; i < len(word); i++ {
		c := word[i] - 'a'
		if node.children[c] == nil {
			node.children[c] = &Trie{}
		}
		node = node.children[c]
	}
	node.end = true
}

func (this *Trie) find(prefix string) *Trie {
	node := this
	for i := 0; i < len(prefix) && node != nil; i++ {
		node = node.children[prefix[i]-'a']
	}
	return node
}

func (this *Trie) Search(word string) bool {
	node := this.find(word)
	return node != nil && node.end
}

func (this *Trie) StartsWith(prefix string) bool {
	return this.find(prefix) != nil
}
