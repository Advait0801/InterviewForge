impl Solution {
    pub fn combination_sum(mut candidates: Vec<i32>, target: i32) -> Vec<Vec<i32>> {
        fn dfs(c: &[i32], start: usize, remaining: i32, cur: &mut Vec<i32>, out: &mut Vec<Vec<i32>>) {
            if remaining == 0 {
                out.push(cur.clone());
                return;
            }
            for i in start..c.len() {
                if c[i] > remaining {
                    break;
                }
                cur.push(c[i]);
                dfs(c, i, remaining - c[i], cur, out);
                cur.pop();
            }
        }
        candidates.sort();
        let mut out = vec![];
        dfs(&candidates, 0, target, &mut vec![], &mut out);
        out
    }
}
