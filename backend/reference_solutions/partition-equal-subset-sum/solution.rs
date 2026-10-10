impl Solution {
    pub fn can_partition(nums: Vec<i32>) -> bool {
        let total: i32 = nums.iter().sum();
        if total % 2 == 1 {
            return false;
        }
        let half = (total / 2) as usize;
        let mut can = vec![false; half + 1];
        can[0] = true;
        for x in nums {
            let x = x as usize;
            for s in (x..=half).rev() {
                can[s] = can[s] || can[s - x];
            }
        }
        can[half]
    }
}
