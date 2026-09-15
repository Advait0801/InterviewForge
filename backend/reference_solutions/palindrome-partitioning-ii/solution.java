class Solution {
    public int minCut(String s) {
        int n = s.length();
        int[] cuts = new int[n + 1];
        for (int i = 0; i <= n; i++) cuts[i] = i - 1;
        for (int center = 0; center < n; center++)
            for (int odd = 0; odd <= 1; odd++)
                for (int left = center, right = center + odd; left >= 0 && right < n && s.charAt(left) == s.charAt(right); left--, right++)
                    cuts[right + 1] = Math.min(cuts[right + 1], cuts[left] + 1);
        return cuts[n];
    }
}
