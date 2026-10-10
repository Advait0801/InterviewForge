impl Solution {
    pub fn critical_connections(n: i32, connections: Vec<Vec<i32>>) -> Vec<Vec<i32>> {
        let n = n as usize;
        let mut adj = vec![vec![]; n];
        for e in &connections {
            adj[e[0] as usize].push(e[1] as usize);
            adj[e[1] as usize].push(e[0] as usize);
        }
        let (mut disc, mut low) = (vec![usize::MAX; n], vec![0; n]);
        let (mut time, mut out) = (0, vec![]);
        // Iterative DFS: recursion depth would reach n.
        for s in 0..n {
            if disc[s] != usize::MAX {
                continue;
            }
            disc[s] = time;
            low[s] = time;
            time += 1;
            let mut stack = vec![(s, usize::MAX, 0usize)];
            while let Some(&mut (u, parent, ref mut next)) = stack.last_mut() {
                if *next < adj[u].len() {
                    let v = adj[u][*next];
                    *next += 1;
                    if v == parent {
                        continue;
                    }
                    if disc[v] == usize::MAX {
                        disc[v] = time;
                        low[v] = time;
                        time += 1;
                        stack.push((v, u, 0));
                    } else {
                        low[u] = low[u].min(disc[v]);
                    }
                } else {
                    stack.pop();
                    if parent != usize::MAX {
                        low[parent] = low[parent].min(low[u]);
                        if low[u] > disc[parent] {
                            out.push(vec![parent as i32, u as i32]);
                        }
                    }
                }
            }
        }
        out
    }
}
