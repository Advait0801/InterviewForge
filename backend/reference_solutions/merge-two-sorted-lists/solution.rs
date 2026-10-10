impl Solution {
    pub fn merge_two_lists(list1: Option<Box<ListNode>>, list2: Option<Box<ListNode>>) -> Option<Box<ListNode>> {
        match (list1, list2) {
            (None, l) | (l, None) => l,
            (Some(mut a), Some(mut b)) => {
                if a.val <= b.val {
                    a.next = Self::merge_two_lists(a.next.take(), Some(b));
                    Some(a)
                } else {
                    b.next = Self::merge_two_lists(Some(a), b.next.take());
                    Some(b)
                }
            }
        }
    }
}
