class Solution {
public:
    string longestCommonPrefix(vector<string>& strs) {
        size_t len = strs[0].size();
        for (size_t i = 1; i < strs.size(); i++) {
            size_t j = 0;
            while (j < len && j < strs[i].size() && strs[i][j] == strs[0][j]) j++;
            len = j;
        }
        return strs[0].substr(0, len);
    }
};
