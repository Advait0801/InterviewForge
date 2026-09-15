static int balancedHeight(struct TreeNode* node) {
    if (!node) return 0;
    int l = balancedHeight(node->left);
    if (l < 0) return -1;
    int r = balancedHeight(node->right);
    if (r < 0 || abs(l - r) > 1) return -1;
    return 1 + (l > r ? l : r);
}
bool isBalanced(struct TreeNode* root) {
    return balancedHeight(root) >= 0;
}
