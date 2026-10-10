impl Solution {
    pub fn is_palindrome(head: Option<Box<ListNode>>) -> bool {
        let mut vals = vec![];
        let mut cur = head.as_ref();
        while let Some(n) = cur {
            vals.push(n.val);
            cur = n.next.as_ref();
        }
        vals.iter().eq(vals.iter().rev())
    }
}
