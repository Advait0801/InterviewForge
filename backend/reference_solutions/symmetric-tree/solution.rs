use std::rc::Rc;
use std::cell::RefCell;

impl Solution {
    pub fn is_symmetric(root: Option<Rc<RefCell<TreeNode>>>) -> bool {
        fn mirror(a: &Option<Rc<RefCell<TreeNode>>>, b: &Option<Rc<RefCell<TreeNode>>>) -> bool {
            match (a, b) {
                (None, None) => true,
                (Some(x), Some(y)) => {
                    let (x, y) = (x.borrow(), y.borrow());
                    x.val == y.val && mirror(&x.left, &y.right) && mirror(&x.right, &y.left)
                }
                _ => false,
            }
        }
        match &root {
            None => true,
            Some(n) => mirror(&n.borrow().left, &n.borrow().right),
        }
    }
}
