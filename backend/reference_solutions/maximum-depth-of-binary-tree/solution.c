int maxDepth(struct TreeNode* root) {
    if (!root) return 0;
    int l = maxDepth(root->left), r = maxDepth(root->right);
    return 1 + (l > r ? l : r);
}
