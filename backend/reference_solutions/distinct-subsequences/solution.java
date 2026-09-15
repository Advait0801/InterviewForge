class Solution {
    public int numDistinct(String s, String t) {
        long[] dp = new long[t.length() + 1];
        dp[0] = 1;
        for (int i = 0; i < s.length(); i++)
            for (int j = t.length(); j >= 1; j--)
                if (t.charAt(j - 1) == s.charAt(i)) dp[j] += dp[j - 1];
        return (int) dp[t.length()];
    }
}
