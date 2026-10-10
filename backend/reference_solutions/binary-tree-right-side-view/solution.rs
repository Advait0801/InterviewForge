use std::rc::Rc;
use std::cell::RefCell;

impl Solution {
    pub fn right_side_view(root: Option<Rc<RefCell<TreeNode>>>) -> Vec<i32> {
        let mut out = vec![];
        let mut level: Vec<Rc<RefCell<TreeNode>>> = root.into_iter().collect();
        while let Some(last) = level.last() {
            out.push(last.borrow().val);
            level = level
                .iter()
                .flat_map(|n| {
                    let n = n.borrow();
                    [n.left.clone(), n.right.clone()]
                })
                .flatten()
                .collect();
        }
        out
    }
}
