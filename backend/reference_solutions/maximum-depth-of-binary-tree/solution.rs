use std::rc::Rc;
use std::cell::RefCell;

impl Solution {
    pub fn max_depth(root: Option<Rc<RefCell<TreeNode>>>) -> i32 {
        match root {
            None => 0,
            Some(n) => {
                let n = n.borrow();
                1 + Self::max_depth(n.left.clone()).max(Self::max_depth(n.right.clone()))
            }
        }
    }
}
