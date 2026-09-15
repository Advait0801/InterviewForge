class Codec {
public:
    // LeetCode's bracket format: "[1, 2, 3, null, null, 4, 5]". The test cases
    // pin the serialized string itself, not just the round trip.
    string serialize(TreeNode* root) {
        if (!root) return "[]";
        vector<string> out;
        queue<TreeNode*> q;
        q.push(root);
        while (!q.empty()) {
            TreeNode* node = q.front(); q.pop();
            if (!node) { out.push_back("null"); continue; }
            out.push_back(to_string(node->val));
            q.push(node->left);
            q.push(node->right);
        }
        while (!out.empty() && out.back() == "null") out.pop_back();
        string s = "[";
        for (size_t i = 0; i < out.size(); i++) { if (i) s += ", "; s += out[i]; }
        return s + "]";
    }

    TreeNode* deserialize(string data) {
        vector<string> tokens;
        string cur;
        for (char c : data) {
            if (c == '[' || c == ']' || c == ' ') continue;
            if (c == ',') { tokens.push_back(cur); cur.clear(); }
            else cur += c;
        }
        if (!cur.empty()) tokens.push_back(cur);
        if (tokens.empty() || tokens[0] == "null") return nullptr;
        TreeNode* root = new TreeNode(stoi(tokens[0]));
        queue<TreeNode*> q;
        q.push(root);
        size_t i = 1;
        while (!q.empty() && i < tokens.size()) {
            TreeNode* node = q.front(); q.pop();
            if (i < tokens.size() && tokens[i] != "null") { node->left = new TreeNode(stoi(tokens[i])); q.push(node->left); }
            i++;
            if (i < tokens.size() && tokens[i] != "null") { node->right = new TreeNode(stoi(tokens[i])); q.push(node->right); }
            i++;
        }
        return root;
    }
};
