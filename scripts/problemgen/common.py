"""Shared plumbing for generating problem data (Phase 7).

Each batch module declares problems as specs: statement, hints, templates, a
test-case generator and an **oracle**. Expected outputs come from the oracle, a
deliberately naive implementation that shares no code with the reference
solutions in `backend/reference_solutions/`. The verifier then runs those
reference solutions through the real code-runner against the oracle's outputs,
so a green cell means two independent implementations agree -- not that a
solution agrees with itself.

Writes are idempotent: problems and hints are upserted by slug; templates and
problem-meta entries are inserted only if the slug is absent (both files are
hand-formatted, so they are edited as text rather than re-serialised).
"""
from __future__ import annotations

import copy
import json
import os
import random
import zlib
from collections import deque

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROBLEMS_JSON = os.path.join(ROOT, "backend", "leetcode_problems.json")
TEMPLATES_JSON = os.path.join(ROOT, "backend", "starter_templates.json")
HINTS_JSON = os.path.join(ROOT, "backend", "problem_hints.json")
META_TS = os.path.join(ROOT, "code-runner", "src", "problem-meta.ts")

CASES_PER_PROBLEM = 50


# ── trees and lists ──────────────────────────────────────────────────────

class Node:
    def __init__(self, val, left=None, right=None):
        self.val, self.left, self.right = val, left, right


def tree_from_level(arr):
    """LeetCode level-order list (None = missing child) -> Node tree."""
    if not arr or arr[0] is None:
        return None
    root = Node(arr[0])
    queue, i = deque([root]), 1
    while queue and i < len(arr):
        node = queue.popleft()
        if i < len(arr) and arr[i] is not None:
            node.left = Node(arr[i])
            queue.append(node.left)
        i += 1
        if i < len(arr) and arr[i] is not None:
            node.right = Node(arr[i])
            queue.append(node.right)
        i += 1
    return root


def tree_to_level(root):
    out, queue = [], deque([root])
    while queue:
        node = queue.popleft()
        if node is None:
            out.append(None)
            continue
        out.append(node.val)
        queue.append(node.left)
        queue.append(node.right)
    while out and out[-1] is None:
        out.pop()
    return out


def random_tree(rng, n, lo, hi):
    def build(k):
        if k == 0:
            return None
        left = rng.randint(0, k - 1)
        return Node(rng.randint(lo, hi), build(left), build(k - 1 - left))
    return build(n)


def skewed_tree(rng, n, lo, hi):
    root = None
    for _ in range(n):
        node = Node(rng.randint(lo, hi))
        if root is not None:
            if rng.random() < 0.5:
                node.left = root
            else:
                node.right = root
        root = node
    return root


def mirror(node):
    if node is None:
        return None
    return Node(node.val, mirror(node.right), mirror(node.left))


def rand_str(rng, n, alphabet="abcdefghijklmnopqrstuvwxyz"):
    return "".join(rng.choice(alphabet) for _ in range(n))


# ── formatting ───────────────────────────────────────────────────────────

def fmt_value(value):
    return json.dumps(value)  # [1, 2], "s", null, true -- matches existing inputs


def fmt_output(value):
    return json.dumps(value, separators=(",", ":"))


def build_cases(spec):
    rng = random.Random(zlib.crc32(spec["slug"].encode()))
    names = [name for name, _ in spec.get("params", [])]
    want = spec.get("case_count", CASES_PER_PROBLEM)
    seen, cases = set(), []
    for attempt, args in enumerate(spec["cases"](rng)):
        if attempt > 20000:
            break
        if spec.get("design"):
            # Design problems: the operations line, then the per-operation arguments line.
            text = json.dumps(args[0]) + "\n" + json.dumps(args[1])
        else:
            text = ", ".join(f"{n} = {fmt_value(a)}" for n, a in zip(names, args))
        if text in seen:
            continue
        seen.add(text)
        expected = spec["oracle"](*copy.deepcopy(list(args)))
        cases.append({"input": text, "expectedOutput": fmt_output(expected)})
        if len(cases) == want:
            break
    if len(cases) != want:
        raise SystemExit(f"{spec['slug']}: only {len(cases)} distinct cases, wanted {want}")
    return cases


# ── writers ──────────────────────────────────────────────────────────────

def _dump_json(path, data, raw):
    text = json.dumps(data, indent=2, ensure_ascii=False)
    if raw.endswith("\n"):
        text += "\n"
    with open(path, "w") as handle:
        handle.write(text)


def upsert_problems(specs):
    with open(PROBLEMS_JSON) as handle:
        raw = handle.read()
    problems = json.loads(raw)
    index = {p["slug"]: i for i, p in enumerate(problems)}
    for spec in specs:
        entry = {
            "slug": spec["slug"],
            "title": spec["title"],
            "leetcodeNumber": spec["number"],
            "description": spec["description"].strip(),
            "difficulty": spec["difficulty"],
            "topics": spec["topics"],
            "companies": spec["companies"],
            "testCases": build_cases(spec),
        }
        if spec["slug"] in index:
            problems[index[spec["slug"]]] = entry
        else:
            index[spec["slug"]] = len(problems)
            problems.append(entry)
    _dump_json(PROBLEMS_JSON, problems, raw)
    return len(problems)


def upsert_hints(specs):
    with open(HINTS_JSON) as handle:
        raw = handle.read()
    hints = json.loads(raw)
    for spec in specs:
        if len(spec["hints"]) != 3:
            raise SystemExit(f"{spec['slug']}: needs exactly 3 hints")
        hints[spec["slug"]] = spec["hints"]
    _dump_json(HINTS_JSON, hints, raw)


def _json_params(params):
    return ", ".join(f'{{ "name": {json.dumps(n)}, "type": {json.dumps(t)} }}' for n, t in params)


def _template_entry(spec):
    lines = [f"  {json.dumps(spec['slug'])}: {{", '    "meta": {']
    if spec.get("design"):
        lines += [f'      "className": {json.dumps(spec["className"])},', '      "isDesign": true,']
        if spec.get("ctor"):
            lines.append(f'      "constructorParams": [{_json_params(spec["ctor"])}],')
        methods = ",\n".join(
            f'        {{ "name": {json.dumps(name)}, "params": [{_json_params(params)}], "returnType": {json.dumps(ret)} }}'
            for name, params, ret in spec["methods"])
        lines += ['      "methods": [', methods, "      ]", "    },"]
    else:
        params = ",\n".join(f"        {_json_params([p])}" for p in spec["params"])
        lines += [
            '      "className": "Solution",',
            f'      "methodName": {json.dumps(spec["method"])},',
            '      "params": [',
            params,
            "      ],",
            f'      "returnType": {json.dumps(spec["ret"])}',
            "    },",
        ]
    langs = ["python3", "cpp", "c", "java"]
    for i, lang in enumerate(langs):
        comma = "," if i < len(langs) - 1 else ""
        lines.append(f"    {json.dumps(lang)}: {json.dumps(spec['templates'][lang])}{comma}")
    lines.append("  }")
    return "\n".join(lines)


def insert_templates(specs):
    with open(TEMPLATES_JSON) as handle:
        raw = handle.read()
    added = [_template_entry(s) for s in specs if f'\n  "{s["slug"]}": {{' not in raw]
    if added:
        body = raw.rstrip()
        assert body.endswith("}"), "unexpected starter_templates.json layout"
        raw = body[:-1].rstrip() + ",\n" + ",\n".join(added) + "\n}\n"
        json.loads(raw)  # must still parse
        with open(TEMPLATES_JSON, "w") as handle:
            handle.write(raw)
    return len(added)


def _ts_params(params):
    return ", ".join(f'{{ name: "{n}", type: "{t}" }}' for n, t in params)


def _meta_entry(spec):
    lines = [f'  "{spec["slug"]}": {{']
    if spec.get("design"):
        lines += [f'    className: "{spec["className"]}",', "    isDesign: true,"]
        if spec.get("ctor"):
            lines.append(f"    constructorParams: [{_ts_params(spec['ctor'])}],")
        lines.append("    methods: [")
        lines += [f'      {{ name: "{name}", params: [{_ts_params(params)}], returnType: "{ret}" }},'
                  for name, params, ret in spec["methods"]]
        lines.append("    ],")
    else:
        lines += [
            '    className: "Solution",',
            f'    methodName: "{spec["method"]}",',
            f"    params: [{_ts_params(spec['params'])}],",
            f'    returnType: "{spec["ret"]}",',
        ]
    for flag in ("unorderedOutput", "unorderedInner"):
        if spec.get(flag):
            lines.append(f"    {flag}: true,")
    lines.append("  },")
    return "\n".join(lines)


def insert_meta(specs):
    with open(META_TS) as handle:
        raw = handle.read()
    added = [_meta_entry(s) for s in specs if f'\n  "{s["slug"]}": {{' not in raw]
    if added:
        cut = raw.rindex("\n};")
        raw = raw[:cut] + "\n" + "\n".join(added) + raw[cut:]
        with open(META_TS, "w") as handle:
            handle.write(raw)
    return len(added)


def write_all(specs):
    slugs = [s["slug"] for s in specs]
    assert len(slugs) == len(set(slugs)), "duplicate slug in batch"
    total = upsert_problems(specs)
    upsert_hints(specs)
    t = insert_templates(specs)
    m = insert_meta(specs)
    print(f"{len(specs)} problems written (catalogue now {total}); templates +{t}, meta +{m}")


# ── template scaffolding (LeetCode's own signatures) ──────────────────────

PY_LIST = ("# Definition for singly-linked list.\n# class ListNode:\n#     def __init__(self, val=0, next=None):\n"
           "#         self.val = val\n#         self.next = next\n")
PY_TREE = ("# Definition for a binary tree node.\n# class TreeNode:\n"
           "#     def __init__(self, val=0, left=None, right=None):\n#         self.val = val\n"
           "#         self.left = left\n#         self.right = right\n")
CPP_LIST = ("/**\n * Definition for singly-linked list.\n * struct ListNode {\n *     int val;\n *     ListNode *next;\n"
            " *     ListNode() : val(0), next(nullptr) {}\n *     ListNode(int x) : val(x), next(nullptr) {}\n"
            " *     ListNode(int x, ListNode *next) : val(x), next(next) {}\n * };\n */\n")
CPP_TREE = ("/**\n * Definition for a binary tree node.\n * struct TreeNode {\n *     int val;\n *     TreeNode *left;\n"
            " *     TreeNode *right;\n *     TreeNode() : val(0), left(nullptr), right(nullptr) {}\n"
            " *     TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}\n"
            " *     TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}\n"
            " * };\n */\n")
C_LIST = ("/**\n * Definition for singly-linked list.\n * struct ListNode {\n *     int val;\n"
          " *     struct ListNode *next;\n * };\n */\n")
C_TREE = ("/**\n * Definition for a binary tree node.\n * struct TreeNode {\n *     int val;\n"
          " *     struct TreeNode *left;\n *     struct TreeNode *right;\n * };\n */\n")
JAVA_LIST = ("/**\n * Definition for singly-linked list.\n * public class ListNode {\n *     int val;\n *     ListNode next;\n"
             " *     ListNode() {}\n *     ListNode(int val) { this.val = val; }\n"
             " *     ListNode(int val, ListNode next) { this.val = val; this.next = next; }\n * }\n */\n")
JAVA_TREE = ("/**\n * Definition for a binary tree node.\n * public class TreeNode {\n *     int val;\n"
             " *     TreeNode left;\n *     TreeNode right;\n *     TreeNode() {}\n"
             " *     TreeNode(int val) { this.val = val; }\n *     TreeNode(int val, TreeNode left, TreeNode right) {\n"
             " *         this.val = val;\n *         this.left = left;\n *         this.right = right;\n *     }\n"
             " * }\n */\n")
C_ARR_NOTE = "/**\n * Note: The returned array must be malloced, assume caller calls free().\n */\n"
C_ARR2_NOTE = ("/**\n * Return an array of arrays of size *returnSize.\n"
               " * The sizes of the arrays are returned as *returnColumnSizes array.\n"
               " * Note: Both returned array and *columnSizes array must be malloced, assume caller calls free().\n */\n")


def templates(py, cpp, c, java, header=None, c_note=""):
    """Build the four starter templates from bare signatures.

    header: None, "list" or "tree" -- prepends LeetCode's node definition comment.
    """
    h = {"list": (PY_LIST, CPP_LIST, C_LIST, JAVA_LIST), "tree": (PY_TREE, CPP_TREE, C_TREE, JAVA_TREE)}
    hp, hcpp, hc, hj = h[header] if header else ("", "", "", "")
    c_head = hc + c_note if hc and c_note else (hc or c_note)
    return {
        "python3": f"{hp}class Solution:\n    def {py}:\n        pass",
        "cpp": f"{hcpp}class Solution {{\npublic:\n    {cpp} {{\n        \n    }}\n}};",
        "c": f"{c_head}{c} {{\n    \n}}",
        "java": f"{hj}class Solution {{\n    public {java} {{\n        \n    }}\n}}",
    }


_PY_T = {"int": "int", "string": "str", "bool": "bool", "void": "None", "double": "float"}
_CPP_T = {"int": "int", "string": "string", "bool": "bool", "void": "void", "double": "double"}
_JAVA_T = {"int": "int", "string": "String", "bool": "boolean", "void": "void", "double": "double"}
_C_T = {"int": "int", "string": "char*", "bool": "bool", "void": "void", "double": "double"}


def design_templates(cls, ctor, methods):
    """Starter templates for a design problem, in LeetCode's layout.

    ctor: [(name, type)]; methods: [(name, [(name, type)], return type)].
    C follows LeetCode's naming: lowerFirst(class) + Create/Method/Free.
    """
    prefix = cls[0].lower() + cls[1:]

    def py_args(ps):
        return "".join(f", {n}: {_PY_T[t]}" for n, t in ps)

    def typed(ps, types):
        return ", ".join(f"{types[t]} {n}" for n, t in ps)

    py = [f"class {cls}:", "", f"    def __init__(self{py_args(ctor)}):", "        pass"]
    cpp = [f"class {cls} {{", "public:", f"    {cls}({typed(ctor, _CPP_T)}) {{", "        ", "    }"]
    java = [f"class {cls} {{", "", f"    public {cls}({typed(ctor, _JAVA_T)}) {{", "        ", "    }"]
    c = ["typedef struct {", "    ", f"}} {cls};", "", "", f"{cls}* {prefix}Create({typed(ctor, _C_T)}) {{", "    ", "}"]
    for name, ps, ret in methods:
        py += ["", f"    def {name}(self{py_args(ps)}) -> {_PY_T[ret]}:", "        pass"]
        cpp += ["    ", f"    {_CPP_T[ret]} {name}({typed(ps, _CPP_T)}) {{", "        ", "    }"]
        java += ["    ", f"    public {_JAVA_T[ret]} {name}({typed(ps, _JAVA_T)}) {{", "        ", "    }"]
        c_args = ", ".join([f"{cls}* obj"] + [f"{_C_T[t]} {n}" for n, t in ps])
        c += ["", f"{_C_T[ret]} {prefix}{name[0].upper() + name[1:]}({c_args}) {{", "    ", "}"]
    cpp.append("};")
    java.append("}")
    c += ["", f"void {prefix}Free({cls}* obj) {{", "    ", "}"]
    return {"python3": "\n".join(py), "cpp": "\n".join(cpp), "c": "\n".join(c), "java": "\n".join(java)}
