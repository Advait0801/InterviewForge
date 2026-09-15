class Solution {
    public int missingNumber(int[] nums) {
        long n = nums.length, total = n * (n + 1) / 2;
        for (int x : nums) total -= x;
        return (int) total;
    }
}
