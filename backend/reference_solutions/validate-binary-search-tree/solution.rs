use std::rc::Rc;
use std::cell::RefCell;

impl Solution {
    pub fn is_valid_bst(root: Option<Rc<RefCell<TreeNode>>>) -> bool {
        fn check(node: &Option<Rc<RefCell<TreeNode>>>, lo: i64, hi: i64) -> bool {
            match node {
                None => true,
                Some(n) => {
                    let n = n.borrow();
                    let v = n.val as i64;
                    v > lo && v < hi && check(&n.left, lo, v) && check(&n.right, v, hi)
                }
            }
        }
        check(&root, i64::MIN, i64::MAX)
    }
}
