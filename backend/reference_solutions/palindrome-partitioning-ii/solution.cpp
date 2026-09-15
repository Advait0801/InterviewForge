class Solution {
public:
    int minCut(string s) {
        int n = s.size();
        vector<int> cuts(n + 1);
        for (int i = 0; i <= n; i++) cuts[i] = i - 1;
        for (int center = 0; center < n; center++)
            for (int odd = 0; odd <= 1; odd++)
                for (int left = center, right = center + odd; left >= 0 && right < n && s[left] == s[right]; left--, right++)
                    cuts[right + 1] = min(cuts[right + 1], cuts[left] + 1);
        return cuts[n];
    }
};
