static int bestPath;
static int gainFrom(struct TreeNode* node) {
    if (!node) return 0;
    int left = gainFrom(node->left), right = gainFrom(node->right);
    if (left < 0) left = 0;
    if (right < 0) right = 0;
    if (node->val + left + right > bestPath) bestPath = node->val + left + right;
    return node->val + (left > right ? left : right);
}
int maxPathSum(struct TreeNode* root) {
    bestPath = root->val;
    gainFrom(root);
    return bestPath;
}
