class Solution {
    void build(vector<string>& out, string& cur, int opened, int closed, int n) {
        if ((int)cur.size() == 2 * n) { out.push_back(cur); return; }
        if (opened < n) { cur.push_back('('); build(out, cur, opened + 1, closed, n); cur.pop_back(); }
        if (closed < opened) { cur.push_back(')'); build(out, cur, opened, closed + 1, n); cur.pop_back(); }
    }
public:
    vector<string> generateParenthesis(int n) {
        vector<string> out;
        string cur;
        build(out, cur, 0, 0, n);
        return out;
    }
};
