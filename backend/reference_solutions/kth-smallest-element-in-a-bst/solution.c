static int bstCount(struct TreeNode* node) {
    return node ? 1 + bstCount(node->left) + bstCount(node->right) : 0;
}
int kthSmallest(struct TreeNode* root, int k) {
    struct TreeNode** stack = (struct TreeNode**)malloc((bstCount(root) + 1) * sizeof(struct TreeNode*));
    int top = 0, answer = -1;
    struct TreeNode* node = root;
    while (node || top) {
        while (node) { stack[top++] = node; node = node->left; }
        node = stack[--top];
        if (--k == 0) { answer = node->val; break; }
        node = node->right;
    }
    free(stack);
    return answer;
}
