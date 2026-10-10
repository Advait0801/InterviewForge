struct MinStack {
    stack: Vec<(i32, i32)>, // (value, minimum so far)
}

impl MinStack {
    fn new() -> Self {
        MinStack { stack: vec![] }
    }

    fn push(&mut self, val: i32) {
        let min = self.stack.last().map_or(val, |&(_, m)| m.min(val));
        self.stack.push((val, min));
    }

    fn pop(&mut self) {
        self.stack.pop();
    }

    fn top(&mut self) -> i32 {
        self.stack.last().unwrap().0
    }

    fn get_min(&mut self) -> i32 {
        self.stack.last().unwrap().1
    }
}
