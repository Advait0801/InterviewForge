/* LeetCode's bracket format: "[1, 2, 3, null, null, 4, 5]". The test cases
   pin the serialized string itself, not just the round trip. */
char* serialize(struct TreeNode* root) {
    if (!root) {
        char* empty = (char*)malloc(3);
        strcpy(empty, "[]");
        return empty;
    }
    int cap = 64, head = 0, tail = 0;
    struct TreeNode** q = (struct TreeNode**)malloc(sizeof(struct TreeNode*) * cap);
    q[tail++] = root;
    int tokCap = 64, tokCount = 0, lastReal = -1;
    char** toks = (char**)malloc(sizeof(char*) * tokCap);
    while (head < tail) {
        struct TreeNode* node = q[head++];
        if (tokCount == tokCap) { tokCap *= 2; toks = (char**)realloc(toks, sizeof(char*) * tokCap); }
        toks[tokCount] = (char*)malloc(16);
        if (!node) { strcpy(toks[tokCount++], "null"); continue; }
        snprintf(toks[tokCount], 16, "%d", node->val);
        lastReal = tokCount++;
        if (tail + 2 > cap) { cap *= 2; q = (struct TreeNode**)realloc(q, sizeof(struct TreeNode*) * cap); }
        q[tail++] = node->left;
        q[tail++] = node->right;
    }
    char* out = (char*)malloc((lastReal + 1) * 18 + 3);
    int len = 0;
    out[len++] = '[';
    for (int i = 0; i <= lastReal; i++) {
        if (i) { out[len++] = ','; out[len++] = ' '; }
        int l = strlen(toks[i]);
        memcpy(out + len, toks[i], l);
        len += l;
    }
    out[len++] = ']';
    out[len] = '\0';
    for (int i = 0; i < tokCount; i++) free(toks[i]);
    free(toks); free(q);
    return out;
}

struct TreeNode* deserialize(char* data) {
    int n = strlen(data), count = 0;
    char** toks = (char**)malloc(sizeof(char*) * (n + 1));
    char* buf = (char*)malloc(n + 1);
    int b = 0;
    for (int i = 0; i <= n; i++) {
        char c = i < n ? data[i] : ',';
        if (c == '[' || c == ']' || c == ' ') continue;
        if (c == ',') {
            if (b > 0) { buf[b] = '\0'; toks[count] = (char*)malloc(b + 1); strcpy(toks[count++], buf); }
            b = 0;
        } else {
            buf[b++] = c;
        }
    }
    free(buf);
    if (count == 0 || strcmp(toks[0], "null") == 0) return NULL;
    struct TreeNode** q = (struct TreeNode**)malloc(sizeof(struct TreeNode*) * (count + 1));
    struct TreeNode* root = (struct TreeNode*)calloc(1, sizeof(struct TreeNode));
    root->val = atoi(toks[0]);
    int head = 0, tail = 0, i = 1;
    q[tail++] = root;
    while (head < tail && i < count) {
        struct TreeNode* node = q[head++];
        if (i < count && strcmp(toks[i], "null") != 0) {
            node->left = (struct TreeNode*)calloc(1, sizeof(struct TreeNode));
            node->left->val = atoi(toks[i]);
            q[tail++] = node->left;
        }
        i++;
        if (i < count && strcmp(toks[i], "null") != 0) {
            node->right = (struct TreeNode*)calloc(1, sizeof(struct TreeNode));
            node->right->val = atoi(toks[i]);
            q[tail++] = node->right;
        }
        i++;
    }
    free(q);
    return root;
}
