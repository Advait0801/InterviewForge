// The list is Rc<RefCell<...>> here: a Box list can't have a cycle.
use std::rc::Rc;
use std::cell::RefCell;

impl Solution {
    pub fn has_cycle(head: Option<Rc<RefCell<ListNode>>>) -> bool {
        let next = |n: &Option<Rc<RefCell<ListNode>>>| n.as_ref().and_then(|x| x.borrow().next.clone());
        let (mut slow, mut fast) = (head.clone(), head);
        loop {
            fast = next(&fast);
            fast = next(&fast);
            slow = next(&slow);
            match (&slow, &fast) {
                (Some(a), Some(b)) if Rc::ptr_eq(a, b) => return true,
                (_, None) => return false,
                _ => {}
            }
        }
    }
}
