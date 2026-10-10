use std::collections::HashMap;

impl Solution {
    pub fn max_points(points: Vec<Vec<i32>>) -> i32 {
        fn gcd(a: i32, b: i32) -> i32 {
            if b == 0 { a.abs() } else { gcd(b, a % b) }
        }
        let mut best = points.len().min(1) as i32;
        for i in 0..points.len() {
            let mut slopes: HashMap<(i32, i32), i32> = HashMap::new();
            for j in i + 1..points.len() {
                let (mut dx, mut dy) = (points[j][0] - points[i][0], points[j][1] - points[i][1]);
                let g = gcd(dx, dy);
                dx /= g;
                dy /= g;
                if dx < 0 || (dx == 0 && dy < 0) {
                    dx = -dx;
                    dy = -dy;
                }
                let count = slopes.entry((dx, dy)).or_insert(1);
                *count += 1;
                best = best.max(*count);
            }
        }
        best
    }
}
