double findMedianSortedArrays(int* nums1, int nums1Size, int* nums2, int nums2Size) {
    if (nums1Size > nums2Size) return findMedianSortedArrays(nums2, nums2Size, nums1, nums1Size);
    const long long NEG = -4000000000000000000LL, POS = 4000000000000000000LL;
    int m = nums1Size, n = nums2Size, half = (m + n + 1) / 2;
    int lo = 0, hi = m;
    while (lo <= hi) {
        int i = (lo + hi) / 2, j = half - i;
        long long l1 = i > 0 ? nums1[i - 1] : NEG;
        long long r1 = i < m ? nums1[i] : POS;
        long long l2 = j > 0 ? nums2[j - 1] : NEG;
        long long r2 = j < n ? nums2[j] : POS;
        if (l1 <= r2 && l2 <= r1) {
            long long left = l1 > l2 ? l1 : l2;
            if ((m + n) % 2) return (double)left;
            long long right = r1 < r2 ? r1 : r2;
            return (left + right) / 2.0;
        }
        if (l1 > r2) hi = i - 1; else lo = i + 1;
    }
    return 0.0;
}
