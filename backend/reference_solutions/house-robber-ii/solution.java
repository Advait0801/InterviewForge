class Solution {
    private int line(int[] nums, int lo, int hi) {
        int take = 0, skip = 0;
        for (int i = lo; i < hi; i++) {
            int newTake = skip + nums[i];
            skip = Math.max(take, skip);
            take = newTake;
        }
        return Math.max(take, skip);
    }
    public int rob(int[] nums) {
        int n = nums.length;
        if (n == 1) return nums[0];
        return Math.max(line(nums, 0, n - 1), line(nums, 1, n));
    }
}
