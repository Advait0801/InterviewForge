use std::rc::Rc;
use std::cell::RefCell;

impl Solution {
    pub fn diameter_of_binary_tree(root: Option<Rc<RefCell<TreeNode>>>) -> i32 {
        fn depth(node: &Option<Rc<RefCell<TreeNode>>>, best: &mut i32) -> i32 {
            match node {
                None => 0,
                Some(n) => {
                    let n = n.borrow();
                    let (l, r) = (depth(&n.left, best), depth(&n.right, best));
                    *best = (*best).max(l + r);
                    1 + l.max(r)
                }
            }
        }
        let mut best = 0;
        depth(&root, &mut best);
        best
    }
}
