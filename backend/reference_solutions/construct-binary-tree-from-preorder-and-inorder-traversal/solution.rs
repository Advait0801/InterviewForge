use std::rc::Rc;
use std::cell::RefCell;
use std::collections::HashMap;

impl Solution {
    pub fn build_tree(preorder: Vec<i32>, inorder: Vec<i32>) -> Option<Rc<RefCell<TreeNode>>> {
        fn build(pre: &[i32], p: &mut usize, lo: i32, hi: i32, index: &HashMap<i32, i32>) -> Option<Rc<RefCell<TreeNode>>> {
            if lo > hi {
                return None;
            }
            let val = pre[*p];
            *p += 1;
            let mid = index[&val];
            let node = Rc::new(RefCell::new(TreeNode::new(val)));
            node.borrow_mut().left = build(pre, p, lo, mid - 1, index);
            node.borrow_mut().right = build(pre, p, mid + 1, hi, index);
            Some(node)
        }
        let index: HashMap<i32, i32> = inorder.iter().enumerate().map(|(i, &v)| (v, i as i32)).collect();
        build(&preorder, &mut 0, 0, inorder.len() as i32 - 1, &index)
    }
}
