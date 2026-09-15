static bool _valid(struct TreeNode* node, long long lo, long long hi) {
    if (!node) return true;
    if (node->val <= lo || node->val >= hi) return false;
    return _valid(node->left, lo, node->val) && _valid(node->right, node->val, hi);
}

bool isValidBST(struct TreeNode* root) {
    return _valid(root, -4000000000000000000LL, 4000000000000000000LL);
}
