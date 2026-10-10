{USER_CODE}
// ── InterviewForge harness (everything below is generated) ──
// Same protocol as python3.py: one JSON object per line on stdin, one JSON
// result per line on stdout. LeetCode's conventions: a regular problem is a
// top-level function, a design problem a class (or constructor function), and
// ListNode / TreeNode are the constructor functions below. The user's code is
// first so a syntax error's line number matches the editor; these are function
// declarations, so they're hoisted above it.

function ListNode(val, next) {
  this.val = val === undefined ? 0 : val;
  this.next = next === undefined ? null : next;
}

function TreeNode(val, left, right) {
  this.val = val === undefined ? 0 : val;
  this.left = left === undefined ? null : left;
  this.right = right === undefined ? null : right;
}

function __arrToList(arr) {
  const dummy = new ListNode();
  let cur = dummy;
  for (const v of arr || []) {
    cur.next = new ListNode(v);
    cur = cur.next;
  }
  return dummy.next;
}

function __arrToCycleList(arr, pos) {
  const nodes = (arr || []).map((v) => new ListNode(v));
  for (let i = 0; i + 1 < nodes.length; i++) nodes[i].next = nodes[i + 1];
  if (nodes.length && pos !== null && pos >= 0 && pos < nodes.length) {
    nodes[nodes.length - 1].next = nodes[pos];
  }
  return nodes.length ? nodes[0] : null;
}

function __listToArr(node) {
  const out = [];
  const seen = new Set();
  while (node && !seen.has(node)) {
    seen.add(node);
    out.push(node.val);
    node = node.next;
  }
  return out;
}

function __arrToTree(arr) {
  if (!arr || !arr.length || arr[0] === null) return null;
  const root = new TreeNode(arr[0]);
  const queue = [root];
  let head = 0;
  let i = 1;
  while (head < queue.length && i < arr.length) {
    const node = queue[head++];
    if (i < arr.length && arr[i] !== null) {
      node.left = new TreeNode(arr[i]);
      queue.push(node.left);
    }
    i++;
    if (i < arr.length && arr[i] !== null) {
      node.right = new TreeNode(arr[i]);
      queue.push(node.right);
    }
    i++;
  }
  return root;
}

function __treeToArr(root) {
  if (!root) return [];
  const out = [];
  const queue = [root];
  let head = 0;
  while (head < queue.length) {
    const node = queue[head++];
    if (node) {
      out.push(node.val);
      queue.push(node.left, node.right);
    } else {
      out.push(null);
    }
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

function __findNode(root, val) {
  if (!root) return null;
  if (root.val === val) return root;
  return __findNode(root.left, val) || __findNode(root.right, val);
}

function __convertArg(val, t) {
  if (t === "ListNode") return __arrToList(val);
  if (t === "ListNode[]") return (val || []).map(__arrToList);
  if (t === "TreeNode") return __arrToTree(val);
  return val;
}

function __convertResult(val, t) {
  if (t === "ListNode" || val instanceof ListNode) return __listToArr(val);
  if (t === "TreeNode" || val instanceof TreeNode) return __treeToArr(val);
  return val === undefined ? null : val;
}

const __COLLECTION_TYPES = new Set(["TreeNode", "ListNode", "int[]", "int[][]", "string[]", "char[]", "char[][]", "ListNode[]"]);
const __MUTABLE_TYPES = new Set(["char[]", "int[]", "int[][]"]);

function __errorMessage(e) {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return String(e);
}

{TARGET}

(function __main() {
  const lines = require("fs").readFileSync(0, "utf-8").split("\n");
  const out = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let data;
    try {
      data = JSON.parse(line);
    } catch {
      out.push(JSON.stringify({ __error: "Invalid JSON input" }));
      continue;
    }
    try {
      if (typeof __IF_TARGET !== "function") {
        const name = data.design ? data.className : data.fn;
        throw new Error(`${name} is not defined. Keep the ${data.design ? "class" : "function"} name from the starter code.`);
      }
      if (data.design) {
        const specs = data.method_specs || {};
        const ctorArgs = Array.isArray(data.args[0]) ? data.args[0] : [];
        const obj = new __IF_TARGET(...ctorArgs);
        const results = [null];
        for (let i = 1; i < data.ops.length; i++) {
          const op = data.ops[i];
          const spec = specs[op] || {};
          const types = spec.param_types || [];
          let rawArgs = data.args[i];
          let callArgs;
          if (types.length === 1) {
            if (!__COLLECTION_TYPES.has(types[0]) && Array.isArray(rawArgs) && rawArgs.length === 1) {
              rawArgs = rawArgs[0];
            }
            callArgs = [__convertArg(rawArgs, types[0])];
          } else {
            callArgs = (Array.isArray(rawArgs) ? rawArgs : [rawArgs]).map((a, k) => __convertArg(a, types[k] || ""));
          }
          if (typeof obj[op] !== "function") throw new Error(`${data.className}.${op} is not a function`);
          const r = obj[op](...callArgs);
          if ((r === null || r === undefined) && (spec.return_type === "TreeNode" || spec.return_type === "ListNode")) {
            results.push([]);
          } else {
            results.push(__convertResult(r, spec.return_type));
          }
        }
        out.push(JSON.stringify(results));
        continue;
      }

      const types = data.arg_types || [];
      const names = data.param_names || [];
      const args = data.args.map((a, k) => __convertArg(a, types[k] || ""));

      if (data.fn === "hasCycle" && args.length === 2) {
        out.push(JSON.stringify(Boolean(__IF_TARGET(__arrToCycleList(data.args[0], data.args[1])))));
        continue;
      }
      // LCA: p and q arrive as values and are passed as references into the tree.
      const root = types[0] === "TreeNode" ? args[0] : null;
      if (root) {
        for (let k = 1; k < args.length; k++) {
          if (types[k] === "int" && (names[k] === "p" || names[k] === "q")) {
            args[k] = __findNode(root, args[k]) || args[k];
          }
        }
      }

      const result = __IF_TARGET(...args);
      if (data.return_type === "void") {
        const k = types.findIndex((t) => __MUTABLE_TYPES.has(t));
        out.push(JSON.stringify(k >= 0 ? args[k] : null));
      } else if (data.return_type === "int" && result instanceof TreeNode) {
        out.push(JSON.stringify(result.val));
      } else {
        out.push(JSON.stringify(__convertResult(result, data.return_type)));
      }
    } catch (e) {
      out.push(JSON.stringify({ __error: __errorMessage(e) }));
    }
  }
  process.stdout.write(out.length ? out.join("\n") + "\n" : "");
})();
