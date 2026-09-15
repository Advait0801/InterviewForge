class Solution {
public:
    bool isMatch(string s, string p) {
        int i = 0, j = 0, star = -1, mark = 0, m = s.size(), n = p.size();
        while (i < m) {
            if (j < n && (p[j] == '?' || p[j] == s[i])) { i++; j++; }
            else if (j < n && p[j] == '*') { star = j++; mark = i; }
            else if (star != -1) { j = star + 1; i = ++mark; }
            else return false;
        }
        while (j < n && p[j] == '*') j++;
        return j == n;
    }
};
