impl Solution {
    pub fn calculate(s: String) -> i32 {
        let (mut result, mut sign, mut num) = (0i64, 1i64, 0i64);
        let mut stack = vec![];
        for ch in s.chars() {
            match ch {
                '0'..='9' => num = num * 10 + (ch as i64 - '0' as i64),
                '+' | '-' => {
                    result += sign * num;
                    num = 0;
                    sign = if ch == '+' { 1 } else { -1 };
                }
                '(' => {
                    stack.push((result, sign));
                    result = 0;
                    sign = 1;
                }
                ')' => {
                    result += sign * num;
                    num = 0;
                    let (prev, prev_sign) = stack.pop().unwrap();
                    result = prev + prev_sign * result;
                }
                _ => {}
            }
        }
        (result + sign * num) as i32
    }
}
