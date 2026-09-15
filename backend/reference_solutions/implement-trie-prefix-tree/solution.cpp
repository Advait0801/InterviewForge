class Trie {
    struct Node {
        Node* child[26] = {};
        bool end = false;
    };
    Node* root;

    Node* walk(const string& s) {
        Node* node = root;
        for (char c : s) {
            node = node->child[c - 'a'];
            if (!node) return nullptr;
        }
        return node;
    }

public:
    Trie() : root(new Node()) {}

    void insert(string word) {
        Node* node = root;
        for (char c : word) {
            if (!node->child[c - 'a']) node->child[c - 'a'] = new Node();
            node = node->child[c - 'a'];
        }
        node->end = true;
    }

    bool search(string word) {
        Node* node = walk(word);
        return node && node->end;
    }

    bool startsWith(string prefix) {
        return walk(prefix) != nullptr;
    }
};
