class Solution {
    int count(TreeNode* node, int best) {
        if (!node) return 0;
        int good = node->val >= best;
        best = max(best, node->val);
        return good + count(node->left, best) + count(node->right, best);
    }
public:
    int goodNodes(TreeNode* root) { return count(root, root->val); }
};
