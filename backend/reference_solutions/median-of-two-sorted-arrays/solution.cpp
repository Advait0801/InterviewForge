class Solution {
public:
    double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {
        if (nums1.size() > nums2.size()) return findMedianSortedArrays(nums2, nums1);
        int m = nums1.size(), n = nums2.size(), half = (m + n + 1) / 2;
        int lo = 0, hi = m;
        while (lo <= hi) {
            int i = (lo + hi) / 2, j = half - i;
            long long l1 = i > 0 ? nums1[i - 1] : LLONG_MIN;
            long long r1 = i < m ? nums1[i] : LLONG_MAX;
            long long l2 = j > 0 ? nums2[j - 1] : LLONG_MIN;
            long long r2 = j < n ? nums2[j] : LLONG_MAX;
            if (l1 <= r2 && l2 <= r1) {
                if ((m + n) % 2) return (double)max(l1, l2);
                return (max(l1, l2) + min(r1, r2)) / 2.0;
            }
            if (l1 > r2) hi = i - 1; else lo = i + 1;
        }
        return 0.0;
    }
};
