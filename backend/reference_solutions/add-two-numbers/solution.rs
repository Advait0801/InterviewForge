impl Solution {
    pub fn add_two_numbers(l1: Option<Box<ListNode>>, l2: Option<Box<ListNode>>) -> Option<Box<ListNode>> {
        let (mut a, mut b, mut carry) = (l1, l2, 0);
        let mut digits = vec![];
        while a.is_some() || b.is_some() || carry > 0 {
            let mut s = carry;
            if let Some(n) = a {
                s += n.val;
                a = n.next;
            }
            if let Some(n) = b {
                s += n.val;
                b = n.next;
            }
            digits.push(s % 10);
            carry = s / 10;
        }
        let mut head = None;
        for d in digits.into_iter().rev() {
            let mut node = Box::new(ListNode::new(d));
            node.next = head;
            head = Some(node);
        }
        head
    }
}
