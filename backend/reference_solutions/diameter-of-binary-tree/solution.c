static int diameterBest;
static int diameterHeight(struct TreeNode* node) {
    if (!node) return 0;
    int l = diameterHeight(node->left), r = diameterHeight(node->right);
    if (l + r > diameterBest) diameterBest = l + r;
    return 1 + (l > r ? l : r);
}
int diameterOfBinaryTree(struct TreeNode* root) {
    diameterBest = 0;
    diameterHeight(root);
    return diameterBest;
}
