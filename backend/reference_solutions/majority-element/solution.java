class Solution {
    public int majorityElement(int[] nums) {
        int candidate = 0, count = 0;
        for (int v : nums) {
            if (count == 0) candidate = v;
            count += v == candidate ? 1 : -1;
        }
        return candidate;
    }
}
