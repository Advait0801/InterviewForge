impl Solution {
    pub fn calculate_minimum_hp(dungeon: Vec<Vec<i32>>) -> i32 {
        let (rows, cols) = (dungeon.len(), dungeon[0].len());
        let mut need = vec![i32::MAX; cols + 1];
        need[cols - 1] = 1;
        for r in (0..rows).rev() {
            let mut next = vec![i32::MAX; cols + 1];
            for c in (0..cols).rev() {
                next[c] = (need[c].min(next[c + 1]) - dungeon[r][c]).max(1);
            }
            need = next;
        }
        need[0]
    }
}
