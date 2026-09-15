class Solution {
public:
    TreeNode* lowestCommonAncestor(TreeNode* root, TreeNode* p, TreeNode* q) {
        int lo = min(p->val, q->val), hi = max(p->val, q->val);
        TreeNode* node = root;
        while (node) {
            if (hi < node->val) node = node->left;
            else if (lo > node->val) node = node->right;
            else return node;
        }
        return nullptr;
    }
};
