typedef struct Trie {
    struct Trie* child[26];
    bool end;
} Trie;

Trie* trieCreate() {
    return (Trie*)calloc(1, sizeof(Trie));
}

void trieInsert(Trie* obj, char* word) {
    Trie* node = obj;
    for (; *word; word++) {
        int c = *word - 'a';
        if (!node->child[c]) node->child[c] = trieCreate();
        node = node->child[c];
    }
    node->end = true;
}

static Trie* _trieWalk(Trie* obj, char* s) {
    Trie* node = obj;
    for (; *s && node; s++) node = node->child[*s - 'a'];
    return node;
}

bool trieSearch(Trie* obj, char* word) {
    Trie* node = _trieWalk(obj, word);
    return node && node->end;
}

bool trieStartsWith(Trie* obj, char* prefix) {
    return _trieWalk(obj, prefix) != NULL;
}

void trieFree(Trie* obj) {
    if (!obj) return;
    for (int i = 0; i < 26; i++) trieFree(obj->child[i]);
    free(obj);
}
