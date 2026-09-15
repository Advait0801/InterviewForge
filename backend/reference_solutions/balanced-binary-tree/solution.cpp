class Solution {
    int height(TreeNode* node) {
        if (!node) return 0;
        int l = height(node->left);
        if (l < 0) return -1;
        int r = height(node->right);
        if (r < 0 || abs(l - r) > 1) return -1;
        return 1 + max(l, r);
    }
public:
    bool isBalanced(TreeNode* root) { return height(root) >= 0; }
};
