class Solution {
    public List<List<Integer>> threeSum(int[] nums) {
        Arrays.sort(nums);
        List<List<Integer>> out = new ArrayList<>();
        int n = nums.length;
        for (int i = 0; i + 2 < n; i++) {
            if (i > 0 && nums[i] == nums[i - 1]) continue;
            int lo = i + 1, hi = n - 1;
            while (lo < hi) {
                long sum = (long) nums[i] + nums[lo] + nums[hi];
                if (sum < 0) lo++;
                else if (sum > 0) hi--;
                else {
                    out.add(Arrays.asList(nums[i], nums[lo], nums[hi]));
                    while (lo < hi && nums[lo] == nums[lo + 1]) lo++;
                    while (lo < hi && nums[hi] == nums[hi - 1]) hi--;
                    lo++; hi--;
                }
            }
        }
        return out;
    }
}
