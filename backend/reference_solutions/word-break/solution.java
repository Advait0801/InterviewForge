class Solution {
    public boolean wordBreak(String s, List<String> wordDict) {
        Set<String> words = new HashSet<>(wordDict);
        int n = s.length();
        boolean[] dp = new boolean[n + 1];
        dp[0] = true;
        for (int end = 1; end <= n; end++)
            for (int start = 0; start < end; start++)
                if (dp[start] && words.contains(s.substring(start, end))) { dp[end] = true; break; }
        return dp[n];
    }
}
