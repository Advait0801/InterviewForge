impl Solution {
    pub fn search_matrix(matrix: Vec<Vec<i32>>, target: i32) -> bool {
        let flat: Vec<i32> = matrix.into_iter().flatten().collect();
        flat.binary_search(&target).is_ok()
    }
}
