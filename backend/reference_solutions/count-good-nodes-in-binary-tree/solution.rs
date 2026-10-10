use std::rc::Rc;
use std::cell::RefCell;

impl Solution {
    pub fn good_nodes(root: Option<Rc<RefCell<TreeNode>>>) -> i32 {
        fn count(node: &Option<Rc<RefCell<TreeNode>>>, best: i32) -> i32 {
            match node {
                None => 0,
                Some(n) => {
                    let n = n.borrow();
                    let good = (n.val >= best) as i32;
                    let m = best.max(n.val);
                    good + count(&n.left, m) + count(&n.right, m)
                }
            }
        }
        count(&root, i32::MIN)
    }
}
