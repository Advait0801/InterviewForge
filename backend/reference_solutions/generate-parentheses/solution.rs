impl Solution {
    pub fn generate_parenthesis(n: i32) -> Vec<String> {
        fn build(s: &mut String, open: i32, close: i32, n: i32, out: &mut Vec<String>) {
            if s.len() as i32 == 2 * n {
                out.push(s.clone());
                return;
            }
            if open < n {
                s.push('(');
                build(s, open + 1, close, n, out);
                s.pop();
            }
            if close < open {
                s.push(')');
                build(s, open, close + 1, n, out);
                s.pop();
            }
        }
        let mut out = vec![];
        build(&mut String::new(), 0, 0, n, &mut out);
        out
    }
}
