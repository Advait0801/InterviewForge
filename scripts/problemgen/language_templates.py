"""Starter code for JavaScript, Go and Rust, derived from a problem's signature.

    python scripts/problemgen/language_templates.py          # add/refresh them in starter_templates.json
    python scripts/problemgen/language_templates.py --check  # exit 1 if any entry is missing or stale

The four original languages were written per problem (or per generator spec). These
three follow mechanically from `meta`, the same signature the code-runner harnesses
read, so they're generated rather than hand-written: a template that disagrees with
its harness is a compile error for every user. LeetCode's conventions throughout:
JS functions and classes, Go funcs with `Constructor` and exported methods, Rust
`impl Solution` with snake_case names.

Two problems differ from the plain signature in every language, as they do for the
existing four: linked-list-cycle passes the list (the harness builds the cycle from
`pos`), and the BST lowest-common-ancestor passes and returns nodes.
"""
from __future__ import annotations

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEMPLATES_JSON = os.path.join(ROOT, "backend", "starter_templates.json")

NEW_LANGS = ["javascript", "go", "rust"]


def _special(meta):
    """The signature users see, where it differs from the harness's input."""
    if meta.get("methodName") == "hasCycle":
        return [("head", "ListNode")], "bool"
    if meta.get("methodName") == "lowestCommonAncestor":
        return [("root", "TreeNode"), ("p", "TreeNode"), ("q", "TreeNode")], "TreeNode"
    return [(p["name"], p["type"]) for p in meta["params"]], meta["returnType"]


def _uses(meta, type_name):
    sigs = []
    if meta.get("isDesign"):
        sigs += [p["type"] for p in meta.get("constructorParams", [])]
        for m in meta["methods"]:
            sigs += [p["type"] for p in m["params"]] + [m["returnType"]]
    else:
        params, ret = _special(meta)
        sigs += [t for _, t in params] + [ret]
    return any(t.startswith(type_name) for t in sigs)


def snake(name):
    name = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", name)
    name = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", name)
    return name.lower()


# ── JavaScript ──────────────────────────────────────────────────────────

_JS_T = {
    "int": "number", "double": "number", "bool": "boolean", "string": "string",
    "int[]": "number[]", "int[][]": "number[][]", "string[]": "string[]", "string[][]": "string[][]",
    "char[]": "character[]", "char[][]": "character[][]",
    "ListNode": "ListNode", "ListNode[]": "ListNode[]", "TreeNode": "TreeNode",
}

_JS_LIST = """/**
 * Definition for singly-linked list.
 * function ListNode(val, next) {
 *     this.val = (val===undefined ? 0 : val)
 *     this.next = (next===undefined ? null : next)
 * }
 */"""

_JS_TREE = """/**
 * Definition for a binary tree node.
 * function TreeNode(val, left, right) {
 *     this.val = (val===undefined ? 0 : val)
 *     this.left = (left===undefined ? null : left)
 *     this.right = (right===undefined ? null : right)
 * }
 */"""


def _js_doc(params, ret, indent="", void_note=None):
    lines = [f"{indent}/**"]
    lines += [f"{indent} * @param {{{_JS_T[t]}}} {n}" for n, t in params]
    if ret == "void":
        lines.append(f"{indent} * @return {{void}}" + (f" {void_note}" if void_note else ""))
    else:
        lines.append(f"{indent} * @return {{{_JS_T[ret]}}}")
    lines.append(f"{indent} */")
    return lines


def _mutated(params, ret):
    if ret != "void":
        return None
    for n, t in params:
        if t in ("char[]", "int[]", "int[][]"):
            return n
    return None


def js_template(meta):
    head = []
    if _uses(meta, "ListNode"):
        head.append(_JS_LIST)
    if _uses(meta, "TreeNode"):
        head.append(_JS_TREE)
    if meta.get("isDesign"):
        cls = meta["className"]
        ctor = [(p["name"], p["type"]) for p in meta.get("constructorParams", [])]
        lines = [f"class {cls} {{"]
        if ctor:
            lines += ["    /**"] + [f"     * @param {{{_JS_T[t]}}} {n}" for n, t in ctor] + ["     */"]
        lines += [f"    constructor({', '.join(n for n, _ in ctor)}) {{", "        ", "    }"]
        for m in meta["methods"]:
            ps = [(p["name"], p["type"]) for p in m["params"]]
            lines += [""] + _js_doc(ps, m["returnType"], "    ")
            lines += [f"    {m['name']}({', '.join(n for n, _ in ps)}) {{", "        ", "    }"]
        lines.append("}")
    else:
        params, ret = _special(meta)
        mutated = _mutated(params, ret)
        note = f"Do not return anything, modify {mutated} in-place instead." if mutated else None
        lines = _js_doc(params, ret, void_note=note)
        lines += [f"var {meta['methodName']} = function({', '.join(n for n, _ in params)}) {{", "    ", "};"]
    return "\n".join(head + lines)


# ── Go ──────────────────────────────────────────────────────────────────

_GO_T = {
    "int": "int", "double": "float64", "bool": "bool", "string": "string",
    "int[]": "[]int", "int[][]": "[][]int", "string[]": "[]string", "string[][]": "[][]string",
    "char[]": "[]byte", "char[][]": "[][]byte",
    "ListNode": "*ListNode", "ListNode[]": "[]*ListNode", "TreeNode": "*TreeNode",
}

_GO_LIST = """/**
 * Definition for singly-linked list.
 * type ListNode struct {
 *     Val int
 *     Next *ListNode
 * }
 */"""

_GO_TREE = """/**
 * Definition for a binary tree node.
 * type TreeNode struct {
 *     Val int
 *     Left *TreeNode
 *     Right *TreeNode
 * }
 */"""


def _go_sig(params):
    return ", ".join(f"{n} {_GO_T[t]}" for n, t in params)


def go_template(meta):
    head = []
    if _uses(meta, "ListNode"):
        head.append(_GO_LIST)
    if _uses(meta, "TreeNode"):
        head.append(_GO_TREE)
    if meta.get("isDesign"):
        cls = meta["className"]
        ctor = [(p["name"], p["type"]) for p in meta.get("constructorParams", [])]
        lines = [f"type {cls} struct {{", "    ", "}", "", "", f"func Constructor({_go_sig(ctor)}) {cls} {{", "    ", "}"]
        for m in meta["methods"]:
            ps = [(p["name"], p["type"]) for p in m["params"]]
            ret = "" if m["returnType"] == "void" else " " + _GO_T[m["returnType"]]
            name = m["name"][0].upper() + m["name"][1:]
            lines += ["", "", f"func (this *{cls}) {name}({_go_sig(ps)}){ret} {{", "    ", "}"]
    else:
        params, ret = _special(meta)
        r = "" if ret == "void" else " " + _GO_T[ret]
        lines = [f"func {meta['methodName']}({_go_sig(params)}){r} {{", "    ", "}"]
    return "\n".join(head + lines)


# ── Rust ────────────────────────────────────────────────────────────────

_RS_TREE_T = "Option<Rc<RefCell<TreeNode>>>"
_RS_T = {
    "int": "i32", "double": "f64", "bool": "bool", "string": "String",
    "int[]": "Vec<i32>", "int[][]": "Vec<Vec<i32>>", "string[]": "Vec<String>", "string[][]": "Vec<Vec<String>>",
    "char[]": "Vec<char>", "char[][]": "Vec<Vec<char>>",
    "ListNode": "Option<Box<ListNode>>", "ListNode[]": "Vec<Option<Box<ListNode>>>", "TreeNode": _RS_TREE_T,
}

_RS_LIST = """// Definition for singly-linked list.
// #[derive(PartialEq, Eq, Clone, Debug)]
// pub struct ListNode {
//   pub val: i32,
//   pub next: Option<Box<ListNode>>
// }
//
// impl ListNode {
//   #[inline]
//   fn new(val: i32) -> Self {
//     ListNode {
//       next: None,
//       val
//     }
//   }
// }"""

# Rust has no linked-list-cycle on LeetCode: a Box list can't have a cycle.
_RS_CYCLE_LIST = """// Definition for singly-linked list. Unlike LeetCode's other Rust list
// problems, the list is Rc<RefCell<...>> here: a Box list can't have a cycle.
// #[derive(Debug)]
// pub struct ListNode {
//   pub val: i32,
//   pub next: Option<Rc<RefCell<ListNode>>>
// }
//
// impl ListNode {
//   #[inline]
//   fn new(val: i32) -> Self {
//     ListNode {
//       next: None,
//       val
//     }
//   }
// }"""

_RS_TREE = """// Definition for a binary tree node.
// #[derive(Debug, PartialEq, Eq)]
// pub struct TreeNode {
//   pub val: i32,
//   pub left: Option<Rc<RefCell<TreeNode>>>,
//   pub right: Option<Rc<RefCell<TreeNode>>>,
// }
//
// impl TreeNode {
//   #[inline]
//   pub fn new(val: i32) -> Self {
//     TreeNode {
//       val,
//       left: None,
//       right: None
//     }
//   }
// }"""


def _rs_sig(params, mutated=None, cycle=False):
    out = []
    for n, t in params:
        rt = "Option<Rc<RefCell<ListNode>>>" if cycle and t == "ListNode" else _RS_T[t]
        out.append(f"{snake(n)}: {'&mut ' if n == mutated else ''}{rt}")
    return ", ".join(out)


def rust_template(meta):
    cycle = meta.get("methodName") == "hasCycle"
    head = []
    if cycle:
        head.append(_RS_CYCLE_LIST)
    elif _uses(meta, "ListNode"):
        head.append(_RS_LIST)
    if _uses(meta, "TreeNode"):
        head.append(_RS_TREE)
    if cycle or _uses(meta, "TreeNode"):
        head.append("use std::rc::Rc;\nuse std::cell::RefCell;")
    if meta.get("isDesign"):
        cls = meta["className"]
        ctor = [(p["name"], p["type"]) for p in meta.get("constructorParams", [])]
        lines = [f"struct {cls} {{", "", "}", "", f"impl {cls} {{", "", f"    fn new({_rs_sig(ctor)}) -> Self {{", "        ", "    }"]
        for m in meta["methods"]:
            ps = [(p["name"], p["type"]) for p in m["params"]]
            sig = ", ".join(["&mut self"] + ([_rs_sig(ps)] if ps else []))
            ret = "" if m["returnType"] == "void" else f" -> {_RS_T[m['returnType']]}"
            lines += ["", f"    fn {snake(m['name'])}({sig}){ret} {{", "        ", "    }"]
        lines.append("}")
    else:
        params, ret = _special(meta)
        mutated = _mutated(params, ret)
        r = "" if ret == "void" else f" -> {_RS_T[ret]}"
        lines = [
            "impl Solution {",
            f"    pub fn {snake(meta['methodName'])}({_rs_sig(params, mutated, cycle)}){r} {{",
            "        ",
            "    }",
            "}",
        ]
    return "\n\n".join(head + ["\n".join(lines)]) if head else "\n".join(lines)


GENERATORS = {"javascript": js_template, "go": go_template, "rust": rust_template}


def templates_for(meta):
    return {lang: GENERATORS[lang](meta) for lang in NEW_LANGS}


# ── writing starter_templates.json without disturbing its layout ────────

def _entry_spans(raw):
    """(slug, start, end) of each top-level entry's text."""
    starts = [(m.group(1), m.start()) for m in re.finditer(r'^  "([^"]+)": \{$', raw, flags=re.M)]
    spans = []
    closing = raw.rstrip().rfind("\n}") + 1  # the root object's closing brace
    for k, (slug, start) in enumerate(starts):
        end = starts[k + 1][1] if k + 1 < len(starts) else closing
        spans.append((slug, start, end))
    return spans


def render_entry_languages(text, meta):
    """Replace or append the three languages' lines inside one entry's text."""
    lines = text.rstrip().split("\n")
    trailer = lines.pop()  # "  }" or "  },"
    lines = [l for l in lines if not any(l.startswith(f'    "{lang}": ') for lang in NEW_LANGS)]
    if not lines[-1].endswith(","):
        lines[-1] += ","
    gen = templates_for(meta)
    for i, lang in enumerate(NEW_LANGS):
        comma = "," if i < len(NEW_LANGS) - 1 else ""
        lines.append(f"    {json.dumps(lang)}: {json.dumps(gen[lang])}{comma}")
    return "\n".join(lines + [trailer]) + text[len(text.rstrip()):]


def main(check=False):
    with open(TEMPLATES_JSON) as handle:
        raw = handle.read()
    data = json.loads(raw)
    out, pos = [], 0
    stale = []
    for slug, start, end in _entry_spans(raw):
        out.append(raw[pos:start])
        text = raw[start:end]
        meta = data[slug]["meta"]
        if any(data[slug].get(lang) != GENERATORS[lang](meta) for lang in NEW_LANGS):
            stale.append(slug)
        out.append(render_entry_languages(text, meta) if not check else text)
        pos = end
    out.append(raw[pos:])
    if check:
        if stale:
            print(f"{len(stale)} entries missing or stale, e.g. {stale[:5]}")
            return 1
        print(f"all {len(data)} entries current")
        return 0
    new = "".join(out)
    parsed = json.loads(new)  # must still parse
    assert set(parsed) == set(data), "entries changed"
    for slug in data:
        for lang in ("meta", "python3", "cpp", "c", "java"):
            assert parsed[slug][lang] == data[slug][lang], f"{slug}.{lang} changed"
    with open(TEMPLATES_JSON, "w") as handle:
        handle.write(new)
    print(f"wrote {len(NEW_LANGS)} languages for {len(parsed)} problems ({len(stale)} changed)")
    return 0


if __name__ == "__main__":
    sys.exit(main(check="--check" in sys.argv))
