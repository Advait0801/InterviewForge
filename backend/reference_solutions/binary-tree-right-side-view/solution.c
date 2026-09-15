static int rsvCount(struct TreeNode* node) {
    return node ? 1 + rsvCount(node->left) + rsvCount(node->right) : 0;
}
int* rightSideView(struct TreeNode* root, int* returnSize) {
    int n = rsvCount(root);
    int* out = (int*)malloc((n + 1) * sizeof(int));
    *returnSize = 0;
    if (!root) return out;
    struct TreeNode** queue = (struct TreeNode**)malloc(n * sizeof(struct TreeNode*));
    int head = 0, tail = 0;
    queue[tail++] = root;
    while (head < tail) {
        int levelEnd = tail;
        out[(*returnSize)++] = queue[levelEnd - 1]->val;
        while (head < levelEnd) {
            struct TreeNode* cur = queue[head++];
            if (cur->left) queue[tail++] = cur->left;
            if (cur->right) queue[tail++] = cur->right;
        }
    }
    free(queue);
    return out;
}
