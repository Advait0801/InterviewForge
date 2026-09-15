class Solution {
    public int[] intersection(int[] nums1, int[] nums2) {
        boolean[] present = new boolean[1001];
        for (int v : nums1) present[v] = true;
        int[] out = new int[nums2.length];
        int k = 0;
        for (int v : nums2) if (present[v]) { present[v] = false; out[k++] = v; }
        return java.util.Arrays.copyOf(out, k);
    }
}
