class Solution {
    public String shortestPalindrome(String s) {
        String reversed = new StringBuilder(s).reverse().toString();
        String combined = s + "#" + reversed;
        int[] fail = new int[combined.length()];
        for (int i = 1; i < combined.length(); i++) {
            int k = fail[i - 1];
            while (k > 0 && combined.charAt(i) != combined.charAt(k)) k = fail[k - 1];
            if (combined.charAt(i) == combined.charAt(k)) k++;
            fail[i] = k;
        }
        return reversed.substring(0, s.length() - fail[fail.length - 1]) + s;
    }
}
