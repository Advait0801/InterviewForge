class Solution {
    int best = 0;
    int height(TreeNode* node) {
        if (!node) return 0;
        int l = height(node->left), r = height(node->right);
        best = max(best, l + r);
        return 1 + max(l, r);
    }
public:
    int diameterOfBinaryTree(TreeNode* root) {
        best = 0;
        height(root);
        return best;
    }
};
