class Solution {
public:
    bool isValidBST(TreeNode* root) {
        vector<TreeNode*> st;
        TreeNode* node = root;
        bool havePrev = false;
        long long prev = 0;
        while (!st.empty() || node) {
            while (node) { st.push_back(node); node = node->left; }
            node = st.back(); st.pop_back();
            if (havePrev && node->val <= prev) return false;
            prev = node->val; havePrev = true;
            node = node->right;
        }
        return true;
    }
};
