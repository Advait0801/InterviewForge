impl Solution {
    pub fn find_duplicate(nums: Vec<i32>) -> i32 {
        let next = |i: i32| nums[i as usize];
        let (mut slow, mut fast) = (next(0), next(next(0)));
        while slow != fast {
            slow = next(slow);
            fast = next(next(fast));
        }
        slow = 0;
        while slow != fast {
            slow = next(slow);
            fast = next(fast);
        }
        slow
    }
}
