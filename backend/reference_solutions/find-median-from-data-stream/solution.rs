use std::cmp::Reverse;
use std::collections::BinaryHeap;

struct MedianFinder {
    low: BinaryHeap<i32>,           // max-heap
    high: BinaryHeap<Reverse<i32>>, // min-heap
}

impl MedianFinder {
    fn new() -> Self {
        MedianFinder { low: BinaryHeap::new(), high: BinaryHeap::new() }
    }

    fn add_num(&mut self, num: i32) {
        self.low.push(num);
        let top = self.low.pop().unwrap();
        self.high.push(Reverse(top));
        if self.high.len() > self.low.len() {
            let Reverse(x) = self.high.pop().unwrap();
            self.low.push(x);
        }
    }

    fn find_median(&mut self) -> f64 {
        let lo = *self.low.peek().unwrap() as f64;
        if self.low.len() > self.high.len() {
            lo
        } else {
            (lo + self.high.peek().unwrap().0 as f64) / 2.0
        }
    }
}
