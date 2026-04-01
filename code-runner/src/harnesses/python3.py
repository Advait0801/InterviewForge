import json, sys
from typing import List, Optional
from collections import deque

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def _arr_to_linked(arr):
    if not arr:
        return None
    head = ListNode(arr[0])
    curr = head
    for v in arr[1:]:
        curr.next = ListNode(v)
        curr = curr.next
    return head


def _arr_to_cycle_linked(arr, pos):
    """Build a linked list from values; tail points to node at index pos if pos >= 0."""
    if not arr:
        return None
    nodes = [ListNode(v) for v in arr]
    for i in range(len(nodes) - 1):
        nodes[i].next = nodes[i + 1]
    if pos is not None and pos >= 0:
        nodes[-1].next = nodes[pos]
    return nodes[0]

def _linked_to_arr(node):
    res = []
    while node:
        res.append(node.val)
        node = node.next
    return res

def _arr_to_tree(arr):
    if not arr or arr[0] is None:
        return None
    root = TreeNode(arr[0])
    q = deque([root])
    i = 1
    while q and i < len(arr):
        node = q.popleft()
        if i < len(arr) and arr[i] is not None:
            node.left = TreeNode(arr[i])
            q.append(node.left)
        i += 1
        if i < len(arr) and arr[i] is not None:
            node.right = TreeNode(arr[i])
            q.append(node.right)
        i += 1
    return root

def _tree_to_arr(root):
    if not root:
        return []
    res = []
    q = deque([root])
    while q:
        node = q.popleft()
        if node:
            res.append(node.val)
            q.append(node.left)
            q.append(node.right)
        else:
            res.append(None)
    while res and res[-1] is None:
        res.pop()
    return res

def _find_tree_node(root, val):
    if not root:
        return None
    if root.val == val:
        return root
    l = _find_tree_node(root.left, val)
    if l:
        return l
    return _find_tree_node(root.right, val)

def _convert_arg(val, t):
    if t == "ListNode":
        return _arr_to_linked(val)
    if t == "ListNode[]":
        return [_arr_to_linked(x) for x in (val or [])]
    if t == "TreeNode":
        return _arr_to_tree(val)
    if t == "int[][]":
        return val
    return val

def _convert_result(val, t):
    if isinstance(val, ListNode):
        return _linked_to_arr(val)
    if isinstance(val, TreeNode):
        return _tree_to_arr(val)
    return val

### USER_CODE_START ###
{USER_CODE}
### USER_CODE_END ###

if __name__ == "__main__":
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            print(json.dumps({"__error": "Invalid JSON input"}))
            continue

        try:
            if data.get("design"):
                ops = data["ops"]
                op_args = data["args"]
                method_specs = data.get("method_specs", {})
                cls_name = data["className"]
                cls = globals().get(cls_name) or locals().get(cls_name)
                obj = cls(*op_args[0]) if op_args[0] else cls()
                results = [None]
                for i in range(1, len(ops)):
                    method = getattr(obj, ops[i])
                    spec = method_specs.get(ops[i], {})
                    param_types = spec.get("param_types", [])
                    raw_args = op_args[i]

                    if len(param_types) == 1:
                        t = param_types[0]
                        collection_types = {"TreeNode", "ListNode", "int[]", "int[][]", "string[]", "char[]", "char[][]", "ListNode[]"}
                        if t in collection_types:
                            call_args = [_convert_arg(raw_args, t)]
                        else:
                            if isinstance(raw_args, list) and len(raw_args) == 1:
                                raw_args = raw_args[0]
                            call_args = [_convert_arg(raw_args, t)]
                    else:
                        call_args = raw_args if isinstance(raw_args, list) else [raw_args]
                        if param_types:
                            converted_args = []
                            for idx, a in enumerate(call_args):
                                t = param_types[idx] if idx < len(param_types) else ""
                                converted_args.append(_convert_arg(a, t))
                            call_args = converted_args
                    r = method(*call_args)
                    if r is None:
                        results.append(None)
                    elif isinstance(r, bool):
                        results.append(r)
                    elif isinstance(r, (int, float)):
                        results.append(r)
                    elif isinstance(r, str):
                        results.append(r)
                    elif isinstance(r, TreeNode):
                        results.append(_tree_to_arr(r))
                    elif isinstance(r, ListNode):
                        results.append(_linked_to_arr(r))
                    else:
                        results.append(r)
                print(json.dumps(results))
            else:
                fn_name = data["fn"]
                args = data["args"]
                arg_types = data.get("arg_types", [])
                return_type = data.get("return_type", "")

                converted = []
                tree_root = None
                for i, a in enumerate(args):
                    t = arg_types[i] if i < len(arg_types) else ""
                    ca = _convert_arg(a, t)
                    if t == "TreeNode" and tree_root is None:
                        tree_root = ca
                    converted.append(ca)

                # For LCA-style problems, convert int p/q to TreeNode references
                for i, t in enumerate(arg_types):
                    if t == "int" and tree_root and i > 0:
                        meta_name = data.get("param_names", [])
                        pname = meta_name[i] if i < len(meta_name) else ""
                        if pname in ("p", "q"):
                            node = _find_tree_node(tree_root, converted[i])
                            if node:
                                converted[i] = node

                cls_name = data.get("className", "Solution")
                cls = globals().get(cls_name) or locals().get(cls_name)
                sol = cls()
                fn = getattr(sol, fn_name)

                # Linked List Cycle: build cycle from nums + pos; user only receives head
                if fn_name == "hasCycle" and len(converted) == 2:
                    head = _arr_to_cycle_linked(converted[0], converted[1])
                    try:
                        result = fn(head)
                    except TypeError:
                        result = fn(head, converted[1])
                    print(json.dumps(result))
                    continue

                result = fn(*converted)

                if return_type == "void":
                    # In-place modifications: return first mutable arg
                    for i, t in enumerate(arg_types):
                        if t in ("char[]", "int[]", "int[][]"):
                            print(json.dumps(converted[i]))
                            break
                    else:
                        print(json.dumps(None))
                elif return_type == "int" and isinstance(result, TreeNode):
                    print(json.dumps(result.val))
                else:
                    result = _convert_result(result, return_type)
                    print(json.dumps(result))
        except Exception as e:
            print(json.dumps({"__error": str(e)}))
