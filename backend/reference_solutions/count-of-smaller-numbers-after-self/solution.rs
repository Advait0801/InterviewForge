impl Solution {
    pub fn count_smaller(nums: Vec<i32>) -> Vec<i32> {
        // Fenwick tree over value ranks, scanned right to left.
        let mut sorted = nums.clone();
        sorted.sort();
        sorted.dedup();
        let rank = |v: i32| sorted.binary_search(&v).unwrap() + 1;
        let mut tree = vec![0; sorted.len() + 1];
        let mut out = vec![0; nums.len()];
        for i in (0..nums.len()).rev() {
            let r = rank(nums[i]);
            let (mut j, mut s) = (r - 1, 0);
            while j > 0 {
                s += tree[j];
                j &= j - 1;
            }
            out[i] = s;
            let mut j = r;
            while j < tree.len() {
                tree[j] += 1;
                j += j & j.wrapping_neg();
            }
        }
        out
    }
}
