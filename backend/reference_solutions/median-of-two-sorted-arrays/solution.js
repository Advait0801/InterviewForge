var findMedianSortedArrays = function (nums1, nums2) {
  if (nums1.length > nums2.length) [nums1, nums2] = [nums2, nums1];
  const m = nums1.length, n = nums2.length, half = (m + n + 1) >> 1;
  let lo = 0, hi = m;
  while (lo <= hi) {
    const i = (lo + hi) >> 1, j = half - i;
    const l1 = i > 0 ? nums1[i - 1] : -Infinity, r1 = i < m ? nums1[i] : Infinity;
    const l2 = j > 0 ? nums2[j - 1] : -Infinity, r2 = j < n ? nums2[j] : Infinity;
    if (l1 <= r2 && l2 <= r1) {
      return (m + n) % 2 ? Math.max(l1, l2) : (Math.max(l1, l2) + Math.min(r1, r2)) / 2;
    }
    if (l1 > r2) hi = i - 1;
    else lo = i + 1;
  }
  return 0;
};
