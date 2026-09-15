class Solution {
public:
    bool isValid(string s) {
        vector<char> st;
        for (char c : s) {
            if (c == '(' || c == '[' || c == '{') { st.push_back(c); continue; }
            if (st.empty()) return false;
            char open = st.back(); st.pop_back();
            if ((c == ')' && open != '(') || (c == ']' && open != '[') || (c == '}' && open != '{')) return false;
        }
        return st.empty();
    }
};
