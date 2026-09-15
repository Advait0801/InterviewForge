class Solution {
    public boolean canJump(int[] nums) {
        long reach = 0;
        for (int i = 0; i < nums.length; i++) {
            if (i > reach) return false;
            reach = Math.max(reach, (long) i + nums[i]);
        }
        return true;
    }
}
