class Solution {
    public int lengthOfLongestSubstring(String s) {
        int[] last = new int[256];
        Arrays.fill(last, -1);
        int start = 0, best = 0;
        for (int i = 0; i < s.length(); i++) {
            int c = s.charAt(i) & 0xFF;
            if (last[c] >= start) start = last[c] + 1;
            last[c] = i;
            best = Math.max(best, i - start + 1);
        }
        return best;
    }
}
