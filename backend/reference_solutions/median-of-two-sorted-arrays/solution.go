func findMedianSortedArrays(nums1 []int, nums2 []int) float64 {
	if len(nums1) > len(nums2) {
		nums1, nums2 = nums2, nums1
	}
	m, n := len(nums1), len(nums2)
	half := (m + n + 1) / 2
	lo, hi := 0, m
	for lo <= hi {
		i := (lo + hi) / 2
		j := half - i
		l1, r1, l2, r2 := math.MinInt, math.MaxInt, math.MinInt, math.MaxInt
		if i > 0 {
			l1 = nums1[i-1]
		}
		if i < m {
			r1 = nums1[i]
		}
		if j > 0 {
			l2 = nums2[j-1]
		}
		if j < n {
			r2 = nums2[j]
		}
		if l1 <= r2 && l2 <= r1 {
			if (m+n)%2 == 1 {
				return float64(max(l1, l2))
			}
			return float64(max(l1, l2)+min(r1, r2)) / 2
		}
		if l1 > r2 {
			hi = i - 1
		} else {
			lo = i + 1
		}
	}
	return 0
}
