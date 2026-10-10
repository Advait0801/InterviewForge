impl Solution {
    pub fn reverse_k_group(head: Option<Box<ListNode>>, k: i32) -> Option<Box<ListNode>> {
        let mut vals = vec![];
        let mut cur = head;
        while let Some(node) = cur {
            vals.push(node.val);
            cur = node.next;
        }
        let k = k as usize;
        for chunk in vals.chunks_mut(k) {
            if chunk.len() == k {
                chunk.reverse();
            }
        }
        let mut out = None;
        for v in vals.into_iter().rev() {
            let mut node = Box::new(ListNode::new(v));
            node.next = out;
            out = Some(node);
        }
        out
    }
}
