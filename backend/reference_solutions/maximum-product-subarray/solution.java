class Solution {
    public int maxProduct(int[] nums) {
        long hi = nums[0], lo = nums[0], best = nums[0];
        for (int i = 1; i < nums.length; i++) {
            long v = nums[i], a = hi * v, b = lo * v;
            hi = Math.max(v, Math.max(a, b));
            lo = Math.min(v, Math.min(a, b));
            best = Math.max(best, hi);
        }
        return (int) best;
    }
}
