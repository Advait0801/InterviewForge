impl Solution {
    pub fn find_median_sorted_arrays(nums1: Vec<i32>, nums2: Vec<i32>) -> f64 {
        let (a, b) = if nums1.len() <= nums2.len() { (nums1, nums2) } else { (nums2, nums1) };
        let (m, n) = (a.len(), b.len());
        let half = (m + n + 1) / 2;
        let (mut lo, mut hi) = (0, m);
        loop {
            let i = (lo + hi) / 2;
            let j = half - i;
            let l1 = if i > 0 { a[i - 1] as i64 } else { i64::MIN };
            let r1 = if i < m { a[i] as i64 } else { i64::MAX };
            let l2 = if j > 0 { b[j - 1] as i64 } else { i64::MIN };
            let r2 = if j < n { b[j] as i64 } else { i64::MAX };
            if l1 <= r2 && l2 <= r1 {
                return if (m + n) % 2 == 1 {
                    l1.max(l2) as f64
                } else {
                    (l1.max(l2) + r1.min(r2)) as f64 / 2.0
                };
            }
            if l1 > r2 { hi = i - 1 } else { lo = i + 1 }
        }
    }
}
