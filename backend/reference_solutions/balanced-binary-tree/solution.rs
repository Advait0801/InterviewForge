use std::rc::Rc;
use std::cell::RefCell;

impl Solution {
    pub fn is_balanced(root: Option<Rc<RefCell<TreeNode>>>) -> bool {
        // Height, or -1 once any subtree is unbalanced.
        fn height(node: &Option<Rc<RefCell<TreeNode>>>) -> i32 {
            match node {
                None => 0,
                Some(n) => {
                    let n = n.borrow();
                    let (l, r) = (height(&n.left), height(&n.right));
                    if l < 0 || r < 0 || (l - r).abs() > 1 { -1 } else { 1 + l.max(r) }
                }
            }
        }
        height(&root) >= 0
    }
}
