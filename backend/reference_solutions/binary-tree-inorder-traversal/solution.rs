use std::rc::Rc;
use std::cell::RefCell;

impl Solution {
    pub fn inorder_traversal(root: Option<Rc<RefCell<TreeNode>>>) -> Vec<i32> {
        let (mut out, mut stack) = (vec![], vec![]);
        let mut node = root;
        while node.is_some() || !stack.is_empty() {
            while let Some(n) = node {
                node = n.borrow().left.clone();
                stack.push(n);
            }
            let n = stack.pop().unwrap();
            out.push(n.borrow().val);
            node = n.borrow().right.clone();
        }
        out
    }
}
