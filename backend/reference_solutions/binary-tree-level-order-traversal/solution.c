static int _count(struct TreeNode* node) {
    return node ? 1 + _count(node->left) + _count(node->right) : 0;
}

int** levelOrder(struct TreeNode* root, int* returnSize, int** returnColumnSizes) {
    int total = _count(root);
    *returnSize = 0;
    *returnColumnSizes = (int*)malloc(sizeof(int) * (total ? total : 1));
    if (!root) return (int**)malloc(sizeof(int*));
    int** out = (int**)malloc(sizeof(int*) * total);
    struct TreeNode** q = (struct TreeNode**)malloc(sizeof(struct TreeNode*) * total);
    int head = 0, tail = 0;
    q[tail++] = root;
    while (head < tail) {
        int size = tail - head;
        out[*returnSize] = (int*)malloc(sizeof(int) * size);
        (*returnColumnSizes)[*returnSize] = size;
        for (int i = 0; i < size; i++) {
            struct TreeNode* node = q[head++];
            out[*returnSize][i] = node->val;
            if (node->left) q[tail++] = node->left;
            if (node->right) q[tail++] = node->right;
        }
        (*returnSize)++;
    }
    free(q);
    return out;
}
