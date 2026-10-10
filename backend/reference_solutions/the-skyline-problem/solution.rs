use std::collections::BTreeMap;

impl Solution {
    pub fn get_skyline(buildings: Vec<Vec<i32>>) -> Vec<Vec<i32>> {
        // Sweep the edges; a multiset of live heights (height -> count).
        let mut edges: Vec<(i32, i32)> = vec![];
        for b in &buildings {
            edges.push((b[0], -b[2])); // start: negative so taller starts come first
            edges.push((b[1], b[2]));
        }
        edges.sort();
        let mut live: BTreeMap<i32, i32> = BTreeMap::from([(0, 1)]);
        let (mut out, mut prev): (Vec<Vec<i32>>, i32) = (vec![], 0);
        let mut i = 0;
        while i < edges.len() {
            let x = edges[i].0;
            while i < edges.len() && edges[i].0 == x {
                let h = edges[i].1;
                if h < 0 {
                    *live.entry(-h).or_insert(0) += 1;
                } else {
                    let c = live.get_mut(&h).unwrap();
                    *c -= 1;
                    if *c == 0 {
                        live.remove(&h);
                    }
                }
                i += 1;
            }
            let top = *live.keys().next_back().unwrap();
            if top != prev {
                out.push(vec![x, top]);
                prev = top;
            }
        }
        out
    }
}
