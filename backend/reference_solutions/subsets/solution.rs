impl Solution {
    pub fn subsets(nums: Vec<i32>) -> Vec<Vec<i32>> {
        let mut out = vec![vec![]];
        for x in nums {
            let more: Vec<Vec<i32>> = out.iter().map(|s| {
                let mut t = s.clone();
                t.push(x);
                t
            }).collect();
            out.extend(more);
        }
        out
    }
}
