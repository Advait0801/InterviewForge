class Solution {
    void visit(vector<vector<int>>& g, int i, vector<bool>& seen) {
        seen[i] = true;
        for (int j = 0; j < (int)g.size(); j++)
            if (g[i][j] && !seen[j]) visit(g, j, seen);
    }
public:
    int findCircleNum(vector<vector<int>>& isConnected) {
        vector<bool> seen(isConnected.size(), false);
        int count = 0;
        for (int i = 0; i < (int)isConnected.size(); i++)
            if (!seen[i]) { count++; visit(isConnected, i, seen); }
        return count;
    }
};
