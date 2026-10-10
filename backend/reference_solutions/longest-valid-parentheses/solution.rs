impl Solution {
    pub fn longest_valid_parentheses(s: String) -> i32 {
        let mut stack: Vec<i32> = vec![-1];
        let mut best = 0;
        for (i, c) in s.chars().enumerate() {
            let i = i as i32;
            if c == '(' {
                stack.push(i);
            } else {
                stack.pop();
                match stack.last() {
                    None => stack.push(i),
                    Some(&top) => best = best.max(i - top),
                }
            }
        }
        best
    }
}
