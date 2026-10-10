impl Solution {
    pub fn is_valid(s: String) -> bool {
        let mut stack = Vec::new();
        for c in s.chars() {
            match c {
                ')' | ']' | '}' => {
                    let open = match c { ')' => '(', ']' => '[', _ => '{' };
                    if stack.pop() != Some(open) {
                        return false;
                    }
                }
                _ => stack.push(c),
            }
        }
        stack.is_empty()
    }
}
