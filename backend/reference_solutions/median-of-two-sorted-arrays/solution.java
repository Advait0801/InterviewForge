class Solution {
    public double findMedianSortedArrays(int[] nums1, int[] nums2) {
        if (nums1.length > nums2.length) return findMedianSortedArrays(nums2, nums1);
        int m = nums1.length, n = nums2.length, half = (m + n + 1) / 2;
        int lo = 0, hi = m;
        while (lo <= hi) {
            int i = (lo + hi) / 2, j = half - i;
            long l1 = i > 0 ? nums1[i - 1] : Long.MIN_VALUE;
            long r1 = i < m ? nums1[i] : Long.MAX_VALUE;
            long l2 = j > 0 ? nums2[j - 1] : Long.MIN_VALUE;
            long r2 = j < n ? nums2[j] : Long.MAX_VALUE;
            if (l1 <= r2 && l2 <= r1) {
                if ((m + n) % 2 == 1) return Math.max(l1, l2);
                return (Math.max(l1, l2) + Math.min(r1, r2)) / 2.0;
            }
            if (l1 > r2) hi = i - 1; else lo = i + 1;
        }
        return 0.0;
    }
}
