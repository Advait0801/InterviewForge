impl Solution {
    pub fn majority_element(nums: Vec<i32>) -> i32 {
        let (mut candidate, mut count) = (0, 0);
        for x in nums {
            if count == 0 {
                candidate = x;
            }
            count += if x == candidate { 1 } else { -1 };
        }
        candidate
    }
}
