class Solution {
public:
    int kthSmallest(TreeNode* root, int k) {
        stack<TreeNode*> st;
        TreeNode* node = root;
        while (node || !st.empty()) {
            while (node) { st.push(node); node = node->left; }
            node = st.top(); st.pop();
            if (--k == 0) return node->val;
            node = node->right;
        }
        return -1;
    }
};
