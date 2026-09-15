struct TreeNode* lowestCommonAncestor(struct TreeNode* root, struct TreeNode* p, struct TreeNode* q) {
    int lo = p->val < q->val ? p->val : q->val;
    int hi = p->val < q->val ? q->val : p->val;
    struct TreeNode* node = root;
    while (node) {
        if (hi < node->val) node = node->left;
        else if (lo > node->val) node = node->right;
        else return node;
    }
    return NULL;
}
