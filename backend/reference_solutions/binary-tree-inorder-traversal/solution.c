static int countNodes(struct TreeNode* node) {
    return node ? 1 + countNodes(node->left) + countNodes(node->right) : 0;
}
int* inorderTraversal(struct TreeNode* root, int* returnSize) {
    int n = countNodes(root);
    int* out = (int*)malloc((n + 1) * sizeof(int));
    struct TreeNode** stack = (struct TreeNode**)malloc((n + 1) * sizeof(struct TreeNode*));
    int top = 0, k = 0;
    struct TreeNode* node = root;
    while (node || top) {
        while (node) { stack[top++] = node; node = node->left; }
        node = stack[--top];
        out[k++] = node->val;
        node = node->right;
    }
    free(stack);
    *returnSize = k;
    return out;
}
