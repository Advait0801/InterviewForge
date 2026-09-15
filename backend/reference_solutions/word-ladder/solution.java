class Solution {
    public int ladderLength(String beginWord, String endWord, List<String> wordList) {
        Set<String> words = new HashSet<>(wordList);
        if (!words.contains(endWord)) return 0;
        Deque<String> queue = new ArrayDeque<>();
        queue.add(beginWord);
        words.remove(beginWord);
        for (int steps = 1; !queue.isEmpty(); steps++) {
            for (int size = queue.size(); size > 0; size--) {
                char[] word = queue.poll().toCharArray();
                if (new String(word).equals(endWord)) return steps;
                for (int i = 0; i < word.length; i++) {
                    char original = word[i];
                    for (char ch = 'a'; ch <= 'z'; ch++) {
                        word[i] = ch;
                        String next = new String(word);
                        if (words.remove(next)) queue.add(next);
                    }
                    word[i] = original;
                }
            }
        }
        return 0;
    }
}
