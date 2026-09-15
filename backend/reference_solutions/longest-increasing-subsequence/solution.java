class Solution {
    public int lengthOfLIS(int[] nums) {
        int[] tails = new int[nums.length];
        int len = 0;
        for (int v : nums) {
            int lo = 0, hi = len;
            while (lo < hi) {
                int mid = (lo + hi) / 2;
                if (tails[mid] < v) lo = mid + 1; else hi = mid;
            }
            tails[lo] = v;
            if (lo == len) len++;
        }
        return len;
    }
}
