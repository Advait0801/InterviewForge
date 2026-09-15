class Solution {
    unordered_map<int, int> index;
    int pos = 0;
    TreeNode* build(vector<int>& preorder, int lo, int hi) {
        if (lo > hi) return nullptr;
        TreeNode* node = new TreeNode(preorder[pos++]);
        int mid = index[node->val];
        node->left = build(preorder, lo, mid - 1);
        node->right = build(preorder, mid + 1, hi);
        return node;
    }
public:
    TreeNode* buildTree(vector<int>& preorder, vector<int>& inorder) {
        index.clear();
        pos = 0;
        for (int i = 0; i < (int)inorder.size(); i++) index[inorder[i]] = i;
        return build(preorder, 0, (int)inorder.size() - 1);
    }
};
