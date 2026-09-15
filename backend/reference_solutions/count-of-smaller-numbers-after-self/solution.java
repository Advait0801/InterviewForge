class Solution {
    public List<Integer> countSmaller(int[] nums) {
        final int offset = 10001, size = 20002;
        int[] tree = new int[size + 1];
        Integer[] out = new Integer[nums.length];
        for (int i = nums.length - 1; i >= 0; i--) {
            int idx = nums[i] + offset, total = 0;
            for (int q = idx - 1; q > 0; q -= q & -q) total += tree[q];
            out[i] = total;
            for (; idx <= size; idx += idx & -idx) tree[idx]++;
        }
        return Arrays.asList(out);
    }
}
