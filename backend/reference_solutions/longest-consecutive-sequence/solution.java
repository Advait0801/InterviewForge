class Solution {
    public int longestConsecutive(int[] nums) {
        Set<Long> values = new HashSet<>();
        for (int v : nums) values.add((long) v);
        int best = 0;
        for (long v : values) {
            if (values.contains(v - 1)) continue;
            int length = 1;
            while (values.contains(v + length)) length++;
            best = Math.max(best, length);
        }
        return best;
    }
}
