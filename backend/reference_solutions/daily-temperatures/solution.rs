impl Solution {
    pub fn daily_temperatures(temperatures: Vec<i32>) -> Vec<i32> {
        let mut out = vec![0; temperatures.len()];
        let mut stack: Vec<usize> = vec![];
        for (i, &t) in temperatures.iter().enumerate() {
            while let Some(&j) = stack.last() {
                if temperatures[j] >= t {
                    break;
                }
                stack.pop();
                out[j] = (i - j) as i32;
            }
            stack.push(i);
        }
        out
    }
}
