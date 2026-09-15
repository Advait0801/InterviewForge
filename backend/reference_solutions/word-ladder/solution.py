from collections import deque

class Solution:
    def ladderLength(self, beginWord: str, endWord: str, wordList: List[str]) -> int:
        words = set(wordList)
        if endWord not in words:
            return 0
        queue, seen = deque([(beginWord, 1)]), {beginWord}
        while queue:
            word, steps = queue.popleft()
            if word == endWord:
                return steps
            for i in range(len(word)):
                for ch in "abcdefghijklmnopqrstuvwxyz":
                    nxt = word[:i] + ch + word[i + 1:]
                    if nxt in words and nxt not in seen:
                        seen.add(nxt)
                        queue.append((nxt, steps + 1))
        return 0
