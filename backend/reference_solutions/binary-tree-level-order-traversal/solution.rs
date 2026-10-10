use std::rc::Rc;
use std::cell::RefCell;

impl Solution {
    pub fn level_order(root: Option<Rc<RefCell<TreeNode>>>) -> Vec<Vec<i32>> {
        let mut out = vec![];
        let mut level: Vec<Rc<RefCell<TreeNode>>> = root.into_iter().collect();
        while !level.is_empty() {
            out.push(level.iter().map(|n| n.borrow().val).collect());
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
