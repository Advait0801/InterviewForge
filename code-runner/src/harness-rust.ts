import type { MethodMeta, ParamMeta, ProblemMeta } from "./problem-meta";

/**
 * Rust: LeetCode's conventions. `impl Solution { pub fn two_sum(...) }` for a
 * regular problem, `impl Trie { fn new() -> Self; fn insert(&mut self, ...) }`
 * for a design problem, `Option<Box<ListNode>>` and
 * `Option<Rc<RefCell<TreeNode>>>` for lists and trees.
 *
 * The user's code comes first, so compiler errors point at the editor's line
 * numbers. Everything the harness adds is after it, either at the top level with
 * fully qualified paths (Solution, ListNode, TreeNode -- the user's code names
 * them) or inside `mod __if_harness`, so its `use`s can never clash with the
 * user's (Rust rejects an item imported twice).
 *
 * One exception to LeetCode: Rust has no linked-list-cycle there, because a Box
 * list can't have a cycle. Here that problem's ListNode is
 * `Option<Rc<RefCell<ListNode>>>`.
 */

/** twoSum -> two_sum, isValidBST -> is_valid_bst, LRUCache stays a type name elsewhere. */
export function snakeCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

const TREE = "Option<std::rc::Rc<std::cell::RefCell<TreeNode>>>";

const RUST_TYPES: Record<string, string> = {
  int: "i32",
  double: "f64",
  bool: "bool",
  string: "String",
  "int[]": "Vec<i32>",
  "int[][]": "Vec<Vec<i32>>",
  "string[]": "Vec<String>",
  "string[][]": "Vec<Vec<String>>",
  "char[]": "Vec<char>",
  "char[][]": "Vec<Vec<char>>",
  ListNode: "Option<Box<ListNode>>",
  "ListNode[]": "Vec<Option<Box<ListNode>>>",
  TreeNode: TREE,
};

export function rustType(t: string): string {
  const r = RUST_TYPES[t];
  if (!r) throw new Error(`Rust harness: unsupported type ${t}`);
  return r;
}

/** Converter from a parsed JSON value (`&J`) to the Rust type. */
const READERS: Record<string, string> = {
  int: "j_i32",
  double: "j_f64",
  bool: "j_bool",
  string: "j_string",
  "int[]": "j_vec_i32",
  "int[][]": "j_vec_vec_i32",
  "string[]": "j_vec_string",
  "string[][]": "j_vec_vec_string",
  "char[]": "j_vec_char",
  "char[][]": "j_vec_vec_char",
  ListNode: "j_list",
  "ListNode[]": "j_lists",
  TreeNode: "j_tree",
};

/** Writer from a reference to the Rust value to one JSON line. */
const WRITERS: Record<string, string> = {
  int: "w_i32",
  double: "w_f64",
  bool: "w_bool",
  string: "w_string",
  "int[]": "w_vec_i32",
  "int[][]": "w_vec_vec_i32",
  "string[]": "w_vec_string",
  "string[][]": "w_vec_vec_string",
  "char[]": "w_vec_char",
  "char[][]": "w_vec_vec_char",
  ListNode: "w_list",
  TreeNode: "w_tree",
};

function reader(t: string): string {
  const r = READERS[t];
  if (!r) throw new Error(`Rust harness: unsupported type ${t}`);
  return r;
}

function writer(t: string): string {
  const w = WRITERS[t];
  if (!w) throw new Error(`Rust harness: unsupported return type ${t}`);
  return w;
}

const MUTABLE = ["char[]", "int[]", "int[][]"];

/** Which parameter a void method mutates in place, i.e. takes as `&mut`. */
export function rustMutatedParam(params: ParamMeta[], returnType: string): number {
  return returnType === "void" ? params.findIndex((p) => MUTABLE.includes(p.type)) : -1;
}

function isCycleProblem(meta: ProblemMeta): boolean {
  return meta.methodName === "hasCycle" && (meta.params ?? []).length === 2;
}

function listNodeDefinition(meta: ProblemMeta): string {
  if (isCycleProblem(meta)) {
    return `#[derive(Debug)]
pub struct ListNode {
    pub val: i32,
    pub next: Option<std::rc::Rc<std::cell::RefCell<ListNode>>>,
}
impl ListNode {
    #[inline]
    pub fn new(val: i32) -> Self {
        ListNode { next: None, val }
    }
}`;
  }
  return `#[derive(PartialEq, Eq, Clone, Debug)]
pub struct ListNode {
    pub val: i32,
    pub next: Option<Box<ListNode>>,
}
impl ListNode {
    #[inline]
    pub fn new(val: i32) -> Self {
        ListNode { next: None, val }
    }
}`;
}

const TREE_DEFINITION = `#[derive(Debug, PartialEq, Eq)]
pub struct TreeNode {
    pub val: i32,
    pub left: ${TREE},
    pub right: ${TREE},
}
impl TreeNode {
    #[inline]
    pub fn new(val: i32) -> Self {
        TreeNode { val, left: None, right: None }
    }
}`;

const HARNESS_HELPERS = String.raw`
    use super::*;
    use std::cell::RefCell;
    use std::collections::VecDeque;
    use std::io::{Read, Write};
    use std::rc::Rc;

    #[derive(Clone, Debug)]
    pub enum J { Null, Bool(bool), Num(f64), Str(String), Arr(Vec<J>) }

    struct P<'a> { s: &'a [u8], i: usize }

    impl<'a> P<'a> {
        fn ws(&mut self) { while self.i < self.s.len() && (self.s[self.i] as char).is_whitespace() { self.i += 1; } }
        fn value(&mut self) -> J {
            self.ws();
            if self.i >= self.s.len() { panic!("invalid input: unexpected end"); }
            match self.s[self.i] {
                b'n' => { self.i += 4; J::Null }
                b't' => { self.i += 4; J::Bool(true) }
                b'f' => { self.i += 5; J::Bool(false) }
                b'"' => J::Str(self.string()),
                b'[' => {
                    self.i += 1;
                    let mut items = Vec::new();
                    loop {
                        self.ws();
                        if self.i < self.s.len() && self.s[self.i] == b']' { self.i += 1; break; }
                        items.push(self.value());
                        self.ws();
                        if self.i < self.s.len() && self.s[self.i] == b',' { self.i += 1; }
                    }
                    J::Arr(items)
                }
                _ => {
                    let start = self.i;
                    while self.i < self.s.len() && (self.s[self.i] == b'-' || self.s[self.i] == b'+' || self.s[self.i] == b'.'
                        || self.s[self.i] == b'e' || self.s[self.i] == b'E' || self.s[self.i].is_ascii_digit()) { self.i += 1; }
                    let text = std::str::from_utf8(&self.s[start..self.i]).unwrap_or("");
                    J::Num(text.parse::<f64>().unwrap_or_else(|_| panic!("invalid input: bad number {}", text)))
                }
            }
        }
        fn string(&mut self) -> String {
            self.i += 1;
            let mut bytes: Vec<u8> = Vec::new();
            while self.i < self.s.len() && self.s[self.i] != b'"' {
                if self.s[self.i] == b'\\' {
                    self.i += 1;
                    match self.s[self.i] {
                        b'n' => bytes.push(b'\n'),
                        b't' => bytes.push(b'\t'),
                        b'r' => bytes.push(b'\r'),
                        b'b' => bytes.push(8),
                        b'f' => bytes.push(12),
                        b'u' => {
                            let hex = std::str::from_utf8(&self.s[self.i + 1..self.i + 5]).unwrap_or("0");
                            let code = u32::from_str_radix(hex, 16).unwrap_or(0xfffd);
                            let ch = char::from_u32(code).unwrap_or('\u{fffd}');
                            let mut buf = [0u8; 4];
                            bytes.extend_from_slice(ch.encode_utf8(&mut buf).as_bytes());
                            self.i += 4;
                        }
                        c => bytes.push(c),
                    }
                } else {
                    bytes.push(self.s[self.i]);
                }
                self.i += 1;
            }
            self.i += 1;
            String::from_utf8(bytes).unwrap_or_default()
        }
    }

    pub fn parse(s: &str) -> J { P { s: s.as_bytes(), i: 0 }.value() }

    fn arr(j: &J) -> &Vec<J> { match j { J::Arr(a) => a, _ => panic!("invalid input: expected an array") } }
    pub fn j_i32(j: &J) -> i32 { match j { J::Num(n) => *n as i32, _ => panic!("invalid input: expected an integer") } }
    pub fn j_f64(j: &J) -> f64 { match j { J::Num(n) => *n, _ => panic!("invalid input: expected a number") } }
    pub fn j_bool(j: &J) -> bool { match j { J::Bool(b) => *b, _ => panic!("invalid input: expected a boolean") } }
    pub fn j_string(j: &J) -> String { match j { J::Str(s) => s.clone(), _ => panic!("invalid input: expected a string") } }
    pub fn j_char(j: &J) -> char { j_string(j).chars().next().unwrap_or('\0') }
    pub fn j_vec_i32(j: &J) -> Vec<i32> { arr(j).iter().map(j_i32).collect() }
    pub fn j_vec_vec_i32(j: &J) -> Vec<Vec<i32>> { arr(j).iter().map(j_vec_i32).collect() }
    pub fn j_vec_string(j: &J) -> Vec<String> { arr(j).iter().map(j_string).collect() }
    pub fn j_vec_vec_string(j: &J) -> Vec<Vec<String>> { arr(j).iter().map(j_vec_string).collect() }
    pub fn j_vec_char(j: &J) -> Vec<char> { arr(j).iter().map(j_char).collect() }
    pub fn j_vec_vec_char(j: &J) -> Vec<Vec<char>> { arr(j).iter().map(j_vec_char).collect() }
    pub fn j_tree(j: &J) -> Option<Rc<RefCell<TreeNode>>> {
        let vals = arr(j);
        if vals.is_empty() { return None; }
        if let J::Null = vals[0] { return None; }
        let root = Rc::new(RefCell::new(TreeNode::new(j_i32(&vals[0]))));
        let mut queue = VecDeque::new();
        queue.push_back(root.clone());
        let mut i = 1;
        while i < vals.len() {
            let node = match queue.pop_front() { Some(n) => n, None => break };
            if i < vals.len() {
                if let J::Num(_) = vals[i] {
                    let child = Rc::new(RefCell::new(TreeNode::new(j_i32(&vals[i]))));
                    node.borrow_mut().left = Some(child.clone());
                    queue.push_back(child);
                }
            }
            i += 1;
            if i < vals.len() {
                if let J::Num(_) = vals[i] {
                    let child = Rc::new(RefCell::new(TreeNode::new(j_i32(&vals[i]))));
                    node.borrow_mut().right = Some(child.clone());
                    queue.push_back(child);
                }
            }
            i += 1;
        }
        Some(root)
    }
    pub fn find(root: &Option<Rc<RefCell<TreeNode>>>, val: i32) -> Option<Rc<RefCell<TreeNode>>> {
        let node = root.as_ref()?;
        if node.borrow().val == val { return Some(node.clone()); }
        let left = find(&node.borrow().left, val);
        if left.is_some() { return left; }
        find(&node.borrow().right, val)
    }

    pub fn w_i32(v: &i32) -> String { v.to_string() }
    pub fn w_f64(v: &f64) -> String { format!("{:.5}", v) }
    pub fn w_bool(v: &bool) -> String { v.to_string() }
    pub fn w_string(s: &String) -> String {
        let mut out = String::from("\"");
        for c in s.chars() {
            match c {
                '"' => out.push_str("\\\""),
                '\\' => out.push_str("\\\\"),
                '\n' => out.push_str("\\n"),
                '\t' => out.push_str("\\t"),
                '\r' => out.push_str("\\r"),
                c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
                c => out.push(c),
            }
        }
        out.push('"');
        out
    }
    fn join<T>(xs: &[T], f: fn(&T) -> String) -> String {
        format!("[{}]", xs.iter().map(f).collect::<Vec<_>>().join(","))
    }
    pub fn w_vec_i32(v: &Vec<i32>) -> String { join(v, w_i32) }
    pub fn w_vec_vec_i32(v: &Vec<Vec<i32>>) -> String { join(v, w_vec_i32) }
    pub fn w_vec_string(v: &Vec<String>) -> String { join(v, w_string) }
    pub fn w_vec_vec_string(v: &Vec<Vec<String>>) -> String { join(v, w_vec_string) }
    pub fn w_char(c: &char) -> String { w_string(&c.to_string()) }
    pub fn w_vec_char(v: &Vec<char>) -> String { join(v, w_char) }
    pub fn w_vec_vec_char(v: &Vec<Vec<char>>) -> String { join(v, w_vec_char) }
    pub fn w_tree(root: &Option<Rc<RefCell<TreeNode>>>) -> String {
        let mut parts: Vec<String> = Vec::new();
        let mut queue: VecDeque<Option<Rc<RefCell<TreeNode>>>> = VecDeque::new();
        if root.is_some() { queue.push_back(root.clone()); }
        while let Some(item) = queue.pop_front() {
            match item {
                None => parts.push("null".to_string()),
                Some(node) => {
                    let n = node.borrow();
                    parts.push(n.val.to_string());
                    queue.push_back(n.left.clone());
                    queue.push_back(n.right.clone());
                }
            }
        }
        while parts.last().map(|p| p == "null").unwrap_or(false) { parts.pop(); }
        format!("[{}]", parts.join(","))
    }

    /// A design method's arguments arrive as a list ([["apple"]] -> "apple"), except a lone
    /// collection argument, which arrives bare (serialize gets the tree array itself).
    pub fn darg(raw: &J, k: usize, bare: bool) -> J {
        if bare { return raw.clone(); }
        match raw {
            J::Arr(items) => items.get(k).cloned().unwrap_or_else(|| panic!("invalid input: missing argument")),
            other if k == 0 => other.clone(),
            _ => panic!("invalid input: missing argument"),
        }
    }

    fn panic_message(payload: Box<dyn std::any::Any + Send>) -> String {
        if let Some(s) = payload.downcast_ref::<&str>() { return s.to_string(); }
        if let Some(s) = payload.downcast_ref::<String>() { return s.clone(); }
        "panicked".to_string()
    }

    pub fn run() {
        // The default hook prints to stderr, which shares the output stream and
        // would desynchronise results from cases. Messages are reported per case.
        std::panic::set_hook(Box::new(|_| {}));
        let mut input = String::new();
        std::io::stdin().read_to_string(&mut input).ok();
        let stdout = std::io::stdout();
        let mut out = std::io::BufWriter::new(stdout.lock());
        let mut block: Vec<String> = Vec::new();
        for line in input.lines() {
            let line = line.trim_end_matches('\r');
            if line == "---" {
                let lines = std::mem::take(&mut block);
                let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| case(&lines)));
                let text = match result {
                    Ok(s) => s,
                    Err(p) => format!("{{\"__error\":{}}}", w_string(&panic_message(p))),
                };
                writeln!(out, "{}", text).ok();
            } else {
                block.push(line.to_string());
            }
        }
        out.flush().ok();
    }

    fn line(lines: &[String], i: usize) -> J {
        parse(lines.get(i).unwrap_or_else(|| panic!("invalid input: missing argument")))
    }
`;

function regularCase(meta: ProblemMeta): string {
  const params = meta.params ?? [];
  const ret = meta.returnType ?? "void";
  const fn = snakeCase(meta.methodName ?? "solve");

  if (isCycleProblem(meta)) {
    return `        let vals = j_vec_i32(&line(lines, 0));
        let pos = j_i32(&line(lines, 1));
        let nodes: Vec<Rc<RefCell<ListNode>>> = vals.iter().map(|v| Rc::new(RefCell::new(ListNode::new(*v)))).collect();
        for i in 0..nodes.len().saturating_sub(1) { nodes[i].borrow_mut().next = Some(nodes[i + 1].clone()); }
        if pos >= 0 && (pos as usize) < nodes.len() { nodes[nodes.len() - 1].borrow_mut().next = Some(nodes[pos as usize].clone()); }
        let head = nodes.first().cloned();
        let result = Solution::${fn}(head);
        // Break the cycle so the nodes are freed.
        if let Some(last) = nodes.last() { last.borrow_mut().next = None; }
        w_bool(&result)`;
  }
  if (meta.methodName === "lowestCommonAncestor" && params.length === 3 && params[0].type === "TreeNode") {
    return `        let root = j_tree(&line(lines, 0));
        let p = find(&root, j_i32(&line(lines, 1)));
        let q = find(&root, j_i32(&line(lines, 2)));
        match Solution::${fn}(root, p, q) { Some(n) => n.borrow().val.to_string(), None => "null".to_string() }`;
  }

  const mutated = rustMutatedParam(params, ret);
  const reads = params.map((p, k) => `        let ${k === mutated ? "mut " : ""}a${k} = ${reader(p.type)}(&line(lines, ${k}));`);
  const args = params.map((_, k) => (k === mutated ? `&mut a${k}` : `a${k}`)).join(", ");
  if (ret === "void") {
    return [...reads, `        Solution::${fn}(${args});`, mutated >= 0 ? `        ${writer(params[mutated].type)}(&a${mutated})` : `        "null".to_string()`].join("\n");
  }
  return [...reads, `        let result = Solution::${fn}(${args});`, `        ${writer(ret)}(&result)`].join("\n");
}

const DESIGN_COLLECTION_TYPES = new Set(["TreeNode", "ListNode", "int[]", "int[][]", "string[]", "char[]", "char[][]", "ListNode[]"]);

function designArm(m: MethodMeta): string {
  const bare = m.params.length === 1 && DESIGN_COLLECTION_TYPES.has(m.params[0].type);
  const args = m.params.map((p, k) => `${reader(p.type)}(&darg(raw, ${k}, ${bare}))`).join(", ");
  const call = `obj.${snakeCase(m.name)}(${args})`;
  if (m.returnType === "void") return `                "${m.name}" => { ${call}; "null".to_string() }`;
  return `                "${m.name}" => { let r = ${call}; ${writer(m.returnType)}(&r) }`;
}

function designCase(meta: ProblemMeta): string {
  const ctor = (meta.constructorParams ?? []).map((p, k) => `${reader(p.type)}(&darg(&args[0], ${k}, false))`).join(", ");
  return `        let ops: Vec<String> = j_vec_string(&line(lines, 0));
        let args: Vec<J> = match line(lines, 1) { J::Arr(a) => a, _ => panic!("invalid input: expected an array") };
        #[allow(unused_mut)]
        let mut obj = ${meta.className}::new(${ctor});
        let mut parts: Vec<String> = vec!["null".to_string()];
        for i in 1..ops.len() {
            #[allow(unused_variables)]
            let raw = &args[i];
            let part = match ops[i].as_str() {
${(meta.methods ?? []).map(designArm).join("\n")}
                other => panic!("unknown operation {}", other),
            };
            parts.push(part);
        }
        format!("[{}]", parts.join(","))`;
}

/** Box-list conversions; not for the cycle problem, whose ListNode is Rc<RefCell<..>>. */
const LIST_HELPERS = String.raw`
    pub fn j_list(j: &J) -> Option<Box<ListNode>> {
        let mut head = None;
        for v in arr(j).iter().rev() {
            let mut node = Box::new(ListNode::new(j_i32(v)));
            node.next = head;
            head = Some(node);
        }
        head
    }
    pub fn j_lists(j: &J) -> Vec<Option<Box<ListNode>>> { arr(j).iter().map(j_list).collect() }
    pub fn w_list(list: &Option<Box<ListNode>>) -> String {
        let mut vals = Vec::new();
        let mut cur = list.as_ref();
        while let Some(node) = cur {
            vals.push(node.val);
            cur = node.next.as_ref();
        }
        w_vec_i32(&vals)
    }
`;

/** The whole main.rs: the user's code, then the harness. */
export function generateRust(userCode: string, meta: ProblemMeta): string {
  const body = meta.isDesign ? designCase(meta) : regularCase(meta);
  const listHelpers = isCycleProblem(meta) ? "" : LIST_HELPERS;
  return `${userCode}

// ── InterviewForge harness (everything below is generated) ──
#[allow(dead_code)]
pub struct Solution;

#[allow(dead_code)]
${listNodeDefinition(meta)}

#[allow(dead_code)]
${TREE_DEFINITION}

#[allow(dead_code, unused_imports, unused_variables, non_snake_case)]
mod __if_harness {${HARNESS_HELPERS}${listHelpers}
    fn case(lines: &[String]) -> String {
${body}
    }
}

fn main() {
    __if_harness::run();
}
`;
}
