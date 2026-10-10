use std::rc::Rc;
use std::cell::RefCell;
use std::collections::VecDeque;

struct Codec {}

impl Codec {
    fn new() -> Self {
        Codec {}
    }

    // LeetCode's bracket format: "[1, 2, 3, null, null, 4, 5]", trailing nulls trimmed.
    fn serialize(&mut self, root: Option<Rc<RefCell<TreeNode>>>) -> String {
        let mut out = vec![];
        let mut queue = VecDeque::new();
        if root.is_some() {
            queue.push_back(root);
        }
        while let Some(item) = queue.pop_front() {
            match item {
                None => out.push("null".to_string()),
                Some(n) => {
                    let n = n.borrow();
                    out.push(n.val.to_string());
                    queue.push_back(n.left.clone());
                    queue.push_back(n.right.clone());
                }
            }
        }
        while out.last().map_or(false, |s| s == "null") {
            out.pop();
        }
        format!("[{}]", out.join(", "))
    }

    fn deserialize(&mut self, data: String) -> Option<Rc<RefCell<TreeNode>>> {
        let body = data.trim();
        let body = body[1..body.len() - 1].trim();
        if body.is_empty() {
            return None;
        }
        let make = |t: &str| -> Option<Rc<RefCell<TreeNode>>> {
            let t = t.trim();
            if t == "null" { None } else { Some(Rc::new(RefCell::new(TreeNode::new(t.parse().unwrap())))) }
        };
        let tokens: Vec<&str> = body.split(',').collect();
        let root = make(tokens[0]);
        let mut queue = VecDeque::new();
        queue.push_back(root.clone().unwrap());
        let mut i = 1;
        while let Some(node) = queue.pop_front() {
            if i >= tokens.len() {
                break;
            }
            let left = make(tokens[i]);
            i += 1;
            if let Some(l) = &left {
                queue.push_back(l.clone());
            }
            node.borrow_mut().left = left;
            if i < tokens.len() {
                let right = make(tokens[i]);
                i += 1;
                if let Some(r) = &right {
                    queue.push_back(r.clone());
                }
                node.borrow_mut().right = right;
            }
        }
        root
    }
}
