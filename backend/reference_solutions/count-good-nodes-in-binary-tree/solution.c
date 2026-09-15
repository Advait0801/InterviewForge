static int goodCount(struct TreeNode* node, int best) {
    if (!node) return 0;
    int good = node->val >= best;
    if (node->val > best) best = node->val;
    return good + goodCount(node->left, best) + goodCount(node->right, best);
}
int goodNodes(struct TreeNode* root) {
    return goodCount(root, root->val);
}
