use std::cmp::Reverse;
use std::collections::BinaryHeap;

impl Solution {
    pub fn merge_k_lists(lists: Vec<Option<Box<ListNode>>>) -> Option<Box<ListNode>> {
        let mut heap = BinaryHeap::new();
        for mut list in lists {
            while let Some(mut node) = list {
                list = node.next.take();
                heap.push(Reverse(node.val));
            }
        }
        let mut vals = vec![];
        while let Some(Reverse(v)) = heap.pop() {
            vals.push(v);
        }
        let mut head = None;
        for v in vals.into_iter().rev() {
            let mut node = Box::new(ListNode::new(v));
            node.next = head;
            head = Some(node);
        }
        head
    }
}
