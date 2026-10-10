impl Solution {
    pub fn middle_node(head: Option<Box<ListNode>>) -> Option<Box<ListNode>> {
        let mut len = 0;
        let mut cur = head.as_ref();
        while let Some(n) = cur {
            len += 1;
            cur = n.next.as_ref();
        }
        let mut node = head;
        for _ in 0..len / 2 {
            node = node.unwrap().next;
        }
        node
    }
}
