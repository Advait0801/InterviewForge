class Solution {
    public int longestCommonSubsequence(String text1, String text2) {
        int n = text2.length();
        int[] prev = new int[n + 1], cur = new int[n + 1];
        for (int i = 0; i < text1.length(); i++) {
            for (int j = 0; j < n; j++)
                cur[j + 1] = text1.charAt(i) == text2.charAt(j) ? prev[j] + 1 : Math.max(prev[j + 1], cur[j]);
            int[] t = prev; prev = cur; cur = t;
        }
        return prev[n];
    }
}
