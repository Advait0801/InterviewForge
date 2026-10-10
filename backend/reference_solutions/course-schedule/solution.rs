impl Solution {
    pub fn can_finish(num_courses: i32, prerequisites: Vec<Vec<i32>>) -> bool {
        let n = num_courses as usize;
        let mut adj = vec![vec![]; n];
        let mut indeg = vec![0; n];
        for p in &prerequisites {
            adj[p[1] as usize].push(p[0] as usize);
            indeg[p[0] as usize] += 1;
        }
        let mut queue: Vec<usize> = (0..n).filter(|&i| indeg[i] == 0).collect();
        let mut done = 0;
        while let Some(u) = queue.pop() {
            done += 1;
            for &v in &adj[u] {
                indeg[v] -= 1;
                if indeg[v] == 0 {
                    queue.push(v);
                }
            }
        }
        done == n
    }
}
