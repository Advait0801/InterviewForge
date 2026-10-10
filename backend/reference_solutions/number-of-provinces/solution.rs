impl Solution {
    pub fn find_circle_num(is_connected: Vec<Vec<i32>>) -> i32 {
        fn find(parent: &mut Vec<usize>, x: usize) -> usize {
            if parent[x] != x {
                let root = find(parent, parent[x]);
                parent[x] = root;
            }
            parent[x]
        }
        let n = is_connected.len();
        let mut parent: Vec<usize> = (0..n).collect();
        let mut groups = n as i32;
        for i in 0..n {
            for j in i + 1..n {
                if is_connected[i][j] == 1 {
                    let (a, b) = (find(&mut parent, i), find(&mut parent, j));
                    if a != b {
                        parent[a] = b;
                        groups -= 1;
                    }
                }
            }
        }
        groups
    }
}
