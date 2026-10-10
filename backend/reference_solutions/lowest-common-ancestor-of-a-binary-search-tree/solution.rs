use std::rc::Rc;
use std::cell::RefCell;

impl Solution {
    pub fn lowest_common_ancestor(
        root: Option<Rc<RefCell<TreeNode>>>,
        p: Option<Rc<RefCell<TreeNode>>>,
        q: Option<Rc<RefCell<TreeNode>>>,
    ) -> Option<Rc<RefCell<TreeNode>>> {
        let (pv, qv) = (p?.borrow().val, q?.borrow().val);
        let mut node = root;
        while let Some(n) = node {
            let v = n.borrow().val;
            node = if pv < v && qv < v {
                n.borrow().left.clone()
            } else if pv > v && qv > v {
                n.borrow().right.clone()
            } else {
                return Some(n);
            };
        }
        None
    }
}
