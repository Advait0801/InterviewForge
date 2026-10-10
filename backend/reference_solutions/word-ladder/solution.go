func ladderLength(beginWord string, endWord string, wordList []string) int {
	words := map[string]bool{}
	for _, w := range wordList {
		words[w] = true
	}
	if !words[endWord] {
		return 0
	}
	delete(words, beginWord)
	level, steps := []string{beginWord}, 1
	for len(level) > 0 {
		next := []string{}
		for _, w := range level {
			if w == endWord {
				return steps
			}
			b := []byte(w)
			for i := range b {
				orig := b[i]
				for c := byte('a'); c <= 'z'; c++ {
					b[i] = c
					if cand := string(b); words[cand] {
						delete(words, cand)
						next = append(next, cand)
					}
				}
				b[i] = orig
			}
		}
		level = next
		steps++
	}
	return 0
}
