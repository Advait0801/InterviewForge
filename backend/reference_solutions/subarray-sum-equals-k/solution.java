class Solution {
    public int subarraySum(int[] nums, int k) {
        Map<Integer, Integer> seen = new HashMap<>();
        seen.put(0, 1);
        int total = 0, count = 0;
        for (int v : nums) {
            total += v;
            count += seen.getOrDefault(total - k, 0);
            seen.merge(total, 1, Integer::sum);
        }
        return count;
    }
}
