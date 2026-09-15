static bool mirrorPair(struct TreeNode* a, struct TreeNode* b) {
    if (!a || !b) return a == b;
    return a->val == b->val && mirrorPair(a->left, b->right) && mirrorPair(a->right, b->left);
}
bool isSymmetric(struct TreeNode* root) {
    return mirrorPair(root->left, root->right);
}
