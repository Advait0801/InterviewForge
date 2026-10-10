use std::rc::Rc;
use std::cell::RefCell;

impl Solution {
    pub fn kth_smallest(root: Option<Rc<RefCell<TreeNode>>>, k: i32) -> i32 {
        let (mut stack, mut node, mut k) = (vec![], root, k);
        loop {
            while let Some(n) = node {
                node = n.borrow().left.clone();
                stack.push(n);
            }
            let n = match stack.pop() {
                Some(n) => n,
                None => return -1,
            };
            k -= 1;
            if k == 0 {
                return n.borrow().val;
            }
            node = n.borrow().right.clone();
        }
    }
}
