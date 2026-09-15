class Solution {
    public int numDecodings(String s) {
        long prev2 = 0, prev1 = 1;
        for (int i = 0; i < s.length(); i++) {
            long cur = s.charAt(i) != '0' ? prev1 : 0;
            if (i > 0 && (s.charAt(i - 1) == '1' || (s.charAt(i - 1) == '2' && s.charAt(i) <= '6'))) cur += prev2;
            prev2 = prev1;
            prev1 = cur;
        }
        return (int) prev1;
    }
}
