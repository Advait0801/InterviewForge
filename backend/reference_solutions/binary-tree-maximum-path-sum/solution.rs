use std::rc::Rc;
use std::cell::RefCell;

impl Solution {
    pub fn max_path_sum(root: Option<Rc<RefCell<TreeNode>>>) -> i32 {
        fn gain(node: &Option<Rc<RefCell<TreeNode>>>, best: &mut i32) -> i32 {
            match node {
                None => 0,
                Some(n) => {
                    let n = n.borrow();
                    let l = gain(&n.left, best).max(0);
                    let r = gain(&n.right, best).max(0);
                    *best = (*best).max(n.val + l + r);
                    n.val + l.max(r)
                }
            }
        }
        let mut best = i32::MIN;
        gain(&root, &mut best);
        best
    }
}
