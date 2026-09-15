class Solution {
public:
    vector<int> inorderTraversal(TreeNode* root) {
        vector<int> out;
        stack<TreeNode*> st;
        TreeNode* node = root;
        while (node || !st.empty()) {
            while (node) { st.push(node); node = node->left; }
            node = st.top(); st.pop();
            out.push_back(node->val);
            node = node->right;
        }
        return out;
    }
};
