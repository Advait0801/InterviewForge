impl Solution {
    pub fn least_interval(tasks: Vec<char>, n: i32) -> i32 {
        let mut count = [0i32; 128];
        for &t in &tasks {
            count[t as usize] += 1;
        }
        let top = *count.iter().max().unwrap();
        let at_top = count.iter().filter(|&&c| c == top).count() as i32;
        (tasks.len() as i32).max((top - 1) * (n + 1) + at_top)
    }
}
