impl Solution {
    pub fn remove_nth_from_end(head: Option<Box<ListNode>>, n: i32) -> Option<Box<ListNode>> {
        let mut vals = vec![];
        let mut cur = head;
        while let Some(node) = cur {
            vals.push(node.val);
            cur = node.next;
        }
        vals.remove(vals.len() - n as usize);
        let mut out = None;
        for v in vals.into_iter().rev() {
            let mut node = Box::new(ListNode::new(v));
            node.next = out;
            out = Some(node);
        }
        out
    }
}
