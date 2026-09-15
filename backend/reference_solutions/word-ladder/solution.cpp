class Solution {
public:
    int ladderLength(string beginWord, string endWord, vector<string>& wordList) {
        unordered_set<string> words(wordList.begin(), wordList.end());
        if (!words.count(endWord)) return 0;
        queue<string> q;
        q.push(beginWord);
        words.erase(beginWord);
        for (int steps = 1; !q.empty(); steps++) {
            for (int size = q.size(); size > 0; size--) {
                string word = q.front(); q.pop();
                if (word == endWord) return steps;
                for (size_t i = 0; i < word.size(); i++) {
                    char original = word[i];
                    for (char ch = 'a'; ch <= 'z'; ch++) {
                        word[i] = ch;
                        if (words.count(word)) { words.erase(word); q.push(word); }
                    }
                    word[i] = original;
                }
            }
        }
        return 0;
    }
};
