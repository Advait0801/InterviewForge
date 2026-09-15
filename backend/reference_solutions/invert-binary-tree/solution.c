struct TreeNode* invertTree(struct TreeNode* root) {
    if (!root) return NULL;
    struct TreeNode* left = invertTree(root->left);
    root->left = invertTree(root->right);
    root->right = left;
    return root;
}
