impl Solution {
    pub fn flood_fill(mut image: Vec<Vec<i32>>, sr: i32, sc: i32, color: i32) -> Vec<Vec<i32>> {
        let start = image[sr as usize][sc as usize];
        if start == color {
            return image;
        }
        let (rows, cols) = (image.len() as i32, image[0].len() as i32);
        let mut stack = vec![(sr, sc)];
        image[sr as usize][sc as usize] = color;
        while let Some((r, c)) = stack.pop() {
            for (dr, dc) in [(1, 0), (-1, 0), (0, 1), (0, -1)] {
                let (nr, nc) = (r + dr, c + dc);
                if nr >= 0 && nr < rows && nc >= 0 && nc < cols && image[nr as usize][nc as usize] == start {
                    image[nr as usize][nc as usize] = color;
                    stack.push((nr, nc));
                }
            }
        }
        image
    }
}
