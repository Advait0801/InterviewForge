static bool oneApart(const char* a, const char* b) {
    int diff = 0;
    for (; *a; a++, b++) if (*a != *b && ++diff > 1) return false;
    return diff == 1;
}
int ladderLength(char* beginWord, char* endWord, char** wordList, int wordListSize) {
    int target = -1;
    for (int i = 0; i < wordListSize; i++) if (strcmp(wordList[i], endWord) == 0) target = i;
    if (target < 0) return 0;
    int* dist = (int*)calloc(wordListSize, sizeof(int));
    int* queue = (int*)malloc(wordListSize * sizeof(int));
    int head = 0, tail = 0, answer = 0;
    for (int i = 0; i < wordListSize; i++)
        if (oneApart(beginWord, wordList[i])) { dist[i] = 2; queue[tail++] = i; }
    while (head < tail) {
        int cur = queue[head++];
        if (cur == target) { answer = dist[cur]; break; }
        for (int j = 0; j < wordListSize; j++)
            if (!dist[j] && oneApart(wordList[cur], wordList[j])) { dist[j] = dist[cur] + 1; queue[tail++] = j; }
    }
    free(dist);
    free(queue);
    return answer;
}
