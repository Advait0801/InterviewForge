class Solution {
    int best;
    int gain(TreeNode* node) {
        if (!node) return 0;
        int left = max(gain(node->left), 0), right = max(gain(node->right), 0);
        best = max(best, node->val + left + right);
        return node->val + max(left, right);
    }
public:
    int maxPathSum(TreeNode* root) {
        best = root->val;
        gain(root);
        return best;
    }
};
