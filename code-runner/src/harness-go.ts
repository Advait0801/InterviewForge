import type { MethodMeta, ProblemMeta } from "./problem-meta";

/**
 * Go: LeetCode's conventions. A regular problem is a top-level func (`twoSum`),
 * a design problem a struct with `Constructor(...)` and exported methods
 * (`Insert`), and ListNode / TreeNode are the usual pointer structs.
 *
 * Two files, one package. The user's code is solution.go, so its imports never
 * collide with the harness's (Go rejects a duplicate or unused import) and a
 * compile error points at the user's own line numbers. main.go is generated
 * here. Input is the compiled languages' line-per-argument format: one JSON
 * value per line, "---" after each case; a design case is an ops line and an
 * args line.
 */

const GO_TYPES: Record<string, string> = {
  int: "int",
  double: "float64",
  bool: "bool",
  string: "string",
  "int[]": "[]int",
  "int[][]": "[][]int",
  "string[]": "[]string",
  "string[][]": "[][]string",
  "char[]": "[]byte",
  "char[][]": "[][]byte",
  ListNode: "*ListNode",
  "ListNode[]": "[]*ListNode",
  TreeNode: "*TreeNode",
};

export function goType(t: string): string {
  const g = GO_TYPES[t];
  if (!g) throw new Error(`Go harness: unsupported type ${t}`);
  return g;
}

/** Design methods are exported in Go: insert -> Insert. */
export function goMethodName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Expression converting the JSON text `src` (a string) to a Go value of type t. */
function goRead(src: string, t: string): string {
  switch (t) {
    case "char[]": return `_ifBytes(_ifParse[[]string](${src}))`;
    case "char[][]": return `_ifBytes2(_ifParse[[][]string](${src}))`;
    case "ListNode": return `_ifList(_ifParse[[]int](${src}))`;
    case "ListNode[]": return `_ifLists(_ifParse[[][]int](${src}))`;
    case "TreeNode": return `_ifTree(_ifParse[[]*int](${src}))`;
    default: return `_ifParse[${goType(t)}](${src})`;
  }
}

/** Expression rendering a Go value of type t as one JSON line. */
function goWrite(expr: string, t: string): string {
  switch (t) {
    case "int": return `strconv.Itoa(${expr})`;
    case "double": return `strconv.FormatFloat(${expr}, 'f', 5, 64)`;
    case "bool": return `strconv.FormatBool(${expr})`;
    case "string": return `_ifQuote(${expr})`;
    case "int[]": return `_ifInts(${expr})`;
    case "int[][]": return `_ifInts2(${expr})`;
    case "string[]": return `_ifStrs(${expr})`;
    case "string[][]": return `_ifStrs2(${expr})`;
    case "char[]": return `_ifChars(${expr})`;
    case "char[][]": return `_ifChars2(${expr})`;
    case "ListNode": return `_ifInts(_ifListVals(${expr}))`;
    case "TreeNode": return `_ifTreeJSON(${expr})`;
    default: throw new Error(`Go harness: unsupported return type ${t}`);
  }
}

const GO_HELPERS = String.raw`
type ListNode struct {
	Val  int
	Next *ListNode
}

type TreeNode struct {
	Val   int
	Left  *TreeNode
	Right *TreeNode
}

func _ifParse[T any](s string) T {
	var v T
	if err := json.Unmarshal([]byte(s), &v); err != nil {
		panic("invalid input: " + err.Error())
	}
	return v
}

func _ifBytes(s []string) []byte {
	out := make([]byte, len(s))
	for i, c := range s {
		if len(c) > 0 {
			out[i] = c[0]
		}
	}
	return out
}

func _ifBytes2(s [][]string) [][]byte {
	out := make([][]byte, len(s))
	for i, r := range s {
		out[i] = _ifBytes(r)
	}
	return out
}

func _ifList(vals []int) *ListNode {
	dummy := &ListNode{}
	cur := dummy
	for _, v := range vals {
		cur.Next = &ListNode{Val: v}
		cur = cur.Next
	}
	return dummy.Next
}

func _ifLists(vals [][]int) []*ListNode {
	out := make([]*ListNode, len(vals))
	for i, v := range vals {
		out[i] = _ifList(v)
	}
	return out
}

func _ifCycleList(vals []int, pos int) *ListNode {
	nodes := make([]*ListNode, len(vals))
	for i, v := range vals {
		nodes[i] = &ListNode{Val: v}
	}
	for i := 0; i+1 < len(nodes); i++ {
		nodes[i].Next = nodes[i+1]
	}
	if len(nodes) == 0 {
		return nil
	}
	if pos >= 0 && pos < len(nodes) {
		nodes[len(nodes)-1].Next = nodes[pos]
	}
	return nodes[0]
}

func _ifListVals(head *ListNode) []int {
	out := []int{}
	seen := map[*ListNode]bool{}
	for head != nil && !seen[head] {
		seen[head] = true
		out = append(out, head.Val)
		head = head.Next
	}
	return out
}

func _ifTree(vals []*int) *TreeNode {
	if len(vals) == 0 || vals[0] == nil {
		return nil
	}
	root := &TreeNode{Val: *vals[0]}
	queue := []*TreeNode{root}
	i := 1
	for len(queue) > 0 && i < len(vals) {
		node := queue[0]
		queue = queue[1:]
		if i < len(vals) && vals[i] != nil {
			node.Left = &TreeNode{Val: *vals[i]}
			queue = append(queue, node.Left)
		}
		i++
		if i < len(vals) && vals[i] != nil {
			node.Right = &TreeNode{Val: *vals[i]}
			queue = append(queue, node.Right)
		}
		i++
	}
	return root
}

func _ifFind(root *TreeNode, val int) *TreeNode {
	if root == nil || root.Val == val {
		return root
	}
	if l := _ifFind(root.Left, val); l != nil {
		return l
	}
	return _ifFind(root.Right, val)
}

func _ifTreeJSON(root *TreeNode) string {
	parts := []string{}
	queue := []*TreeNode{root}
	if root == nil {
		queue = nil
	}
	for len(queue) > 0 {
		node := queue[0]
		queue = queue[1:]
		if node == nil {
			parts = append(parts, "null")
			continue
		}
		parts = append(parts, strconv.Itoa(node.Val))
		queue = append(queue, node.Left, node.Right)
	}
	for len(parts) > 0 && parts[len(parts)-1] == "null" {
		parts = parts[:len(parts)-1]
	}
	return "[" + strings.Join(parts, ",") + "]"
}

func _ifQuote(s string) string {
	var b strings.Builder
	b.WriteByte('"')
	for _, r := range s {
		switch {
		case r == '"':
			b.WriteString("\\\"")
		case r == '\\':
			b.WriteString("\\\\")
		case r == '\n':
			b.WriteString("\\n")
		case r == '\t':
			b.WriteString("\\t")
		case r == '\r':
			b.WriteString("\\r")
		case r < 0x20:
			b.WriteString(fmt.Sprintf("\\u%04x", r))
		default:
			b.WriteRune(r)
		}
	}
	b.WriteByte('"')
	return b.String()
}

func _ifJoin[T any](xs []T, f func(T) string) string {
	parts := make([]string, len(xs))
	for i, x := range xs {
		parts[i] = f(x)
	}
	return "[" + strings.Join(parts, ",") + "]"
}

func _ifInts(xs []int) string          { return _ifJoin(xs, strconv.Itoa) }
func _ifInts2(xs [][]int) string       { return _ifJoin(xs, _ifInts) }
func _ifStrs(xs []string) string       { return _ifJoin(xs, _ifQuote) }
func _ifStrs2(xs [][]string) string    { return _ifJoin(xs, _ifStrs) }
func _ifChar(c byte) string            { return _ifQuote(string(rune(c))) }
func _ifChars(xs []byte) string        { return _ifJoin(xs, _ifChar) }
func _ifChars2(xs [][]byte) string     { return _ifJoin(xs, _ifChars) }

// A design method's arguments arrive as a list ([["apple"]] -> "apple"), except
// a lone collection argument, which arrives bare (serialize gets the tree array).
func _ifArg(raw json.RawMessage, k int, bare bool) string {
	if bare {
		return string(raw)
	}
	var list []json.RawMessage
	if err := json.Unmarshal(raw, &list); err != nil {
		if k == 0 {
			return string(raw)
		}
		panic("invalid input: missing argument")
	}
	if k >= len(list) {
		panic("invalid input: missing argument")
	}
	return string(list[k])
}

func _ifRun(out *bufio.Writer, body func() string) {
	line := func() (s string) {
		defer func() {
			if r := recover(); r != nil {
				s = "{\"__error\":" + _ifQuote(fmt.Sprint(r)) + "}"
			}
		}()
		return body()
	}()
	out.WriteString(line)
	out.WriteByte('\n')
}

// Every case is read in full before it runs, so a panic can't desynchronise the input.
func _ifReadCase(in *bufio.Reader) ([]string, bool) {
	var lines []string
	for {
		s, err := in.ReadString('\n')
		s = strings.TrimRight(s, "\r\n")
		if s == "---" {
			return lines, true
		}
		if s != "" || err == nil {
			lines = append(lines, s)
		}
		if err != nil {
			return lines, len(lines) > 0
		}
	}
}

func _ifLine(lines []string, i int) string {
	if i >= len(lines) {
		panic("invalid input: missing argument")
	}
	return lines[i]
}
`;

function regularBody(meta: ProblemMeta): string {
  const params = meta.params ?? [];
  const ret = meta.returnType ?? "void";
  const fn = meta.methodName ?? "solve";
  const reads = params.map((p, k) => `\t\ta${k} := ${goRead(`_ifLine(lines, ${k})`, p.type)}`);
  const args = params.map((_, k) => `a${k}`).join(", ");

  if (fn === "hasCycle" && params.length === 2) {
    return [
      `\t\thead := _ifCycleList(_ifParse[[]int](_ifLine(lines, 0)), _ifParse[int](_ifLine(lines, 1)))`,
      `\t\treturn strconv.FormatBool(${fn}(head))`,
    ].join("\n");
  }
  if (fn === "lowestCommonAncestor" && params.length === 3 && params[0].type === "TreeNode") {
    return [
      reads[0],
      `\t\tp := _ifFind(a0, _ifParse[int](_ifLine(lines, 1)))`,
      `\t\tq := _ifFind(a0, _ifParse[int](_ifLine(lines, 2)))`,
      `\t\tr := ${fn}(a0, p, q)`,
      `\t\tif r == nil {`,
      `\t\t\treturn "null"`,
      `\t\t}`,
      `\t\treturn strconv.Itoa(r.Val)`,
    ].join("\n");
  }
  if (ret === "void") {
    const k = params.findIndex((p) => ["char[]", "int[]", "int[][]"].includes(p.type));
    return [
      ...reads,
      `\t\t${fn}(${args})`,
      k >= 0 ? `\t\treturn ${goWrite(`a${k}`, params[k].type)}` : `\t\treturn "null"`,
    ].join("\n");
  }
  return [...reads, `\t\treturn ${goWrite(`${fn}(${args})`, ret)}`].join("\n");
}

const DESIGN_COLLECTION_TYPES = new Set(["TreeNode", "ListNode", "int[]", "int[][]", "string[]", "char[]", "char[][]", "ListNode[]"]);

function designCase(m: MethodMeta): string {
  const bare = m.params.length === 1 && DESIGN_COLLECTION_TYPES.has(m.params[0].type);
  const args = m.params.map((p, k) => goRead(`_ifArg(raw, ${k}, ${bare})`, p.type)).join(", ");
  const call = `obj.${goMethodName(m.name)}(${args})`;
  if (m.returnType === "void") return `\t\t\tcase "${m.name}":\n\t\t\t\t${call}\n\t\t\t\tparts = append(parts, "null")`;
  return `\t\t\tcase "${m.name}":\n\t\t\t\tparts = append(parts, ${goWrite(call, m.returnType)})`;
}

function designBody(meta: ProblemMeta): string {
  const ctor = (meta.constructorParams ?? []).map((p, k) => goRead(`_ifArg(args[0], ${k}, false)`, p.type)).join(", ");
  const usesRaw = (meta.methods ?? []).some((m) => m.params.length > 0);
  return [
    `\t\tops := _ifParse[[]string](_ifLine(lines, 0))`,
    `\t\targs := _ifParse[[]json.RawMessage](_ifLine(lines, 1))`,
    `\t\tobj := Constructor(${ctor})`,
    `\t\tparts := []string{"null"}`,
    `\t\tfor i := 1; i < len(ops); i++ {`,
    usesRaw ? `\t\t\traw := args[i]` : `\t\t\t_ = args[i]`,
    `\t\t\tswitch ops[i] {`,
    ...(meta.methods ?? []).map(designCase),
    `\t\t\tdefault:`,
    `\t\t\t\tpanic("unknown operation " + ops[i])`,
    `\t\t\t}`,
    `\t\t}`,
    `\t\treturn "[" + strings.Join(parts, ",") + "]"`,
  ].join("\n");
}

export function generateGoMain(meta: ProblemMeta): string {
  const body = meta.isDesign ? designBody(meta) : regularBody(meta);
  return `package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
)
${GO_HELPERS}
func main() {
	in := bufio.NewReaderSize(os.Stdin, 1<<20)
	out := bufio.NewWriter(os.Stdout)
	defer out.Flush()
	for {
		lines, ok := _ifReadCase(in)
		if !ok {
			break
		}
		_ifRun(out, func() string {
${body}
		})
	}
}
`;
}

/**
 * The user's file. A leading `package` clause is replaced (not removed) so line
 * numbers in compiler errors still match the editor.
 */
export function goSolutionFile(userCode: string): string {
  const pkg = /^(\s*(?:\/\/[^\n]*\n\s*)*)package\s+\w+[^\n]*/;
  if (pkg.test(userCode)) return userCode.replace(pkg, (_m, lead: string) => `${lead}package main`);
  return `package main; ${userCode}`;
}
