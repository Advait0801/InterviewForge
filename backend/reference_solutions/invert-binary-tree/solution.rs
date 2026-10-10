use std::rc::Rc;
use std::cell::RefCell;

impl Solution {
    pub fn invert_tree(root: Option<Rc<RefCell<TreeNode>>>) -> Option<Rc<RefCell<TreeNode>>> {
        if let Some(node) = &root {
            let mut n = node.borrow_mut();
            let (l, r) = (n.left.take(), n.right.take());
            n.left = Self::invert_tree(r);
            n.right = Self::invert_tree(l);
        }
        root
    }
}
