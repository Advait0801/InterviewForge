// ifimports adds the standard-library imports a solution uses but didn't write,
// the way LeetCode's Go editor does. Unlike goimports it never reformats: the
// imports go on line 1, after the package clause, so compiler errors keep the
// line numbers the user sees in the editor. Unused imports are left alone (Go
// reports them, as it would anywhere). Usage: ifimports <in.go> <out.go>
package main

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"sort"
	"strconv"
	"strings"
)

// Package name -> import path, for the packages a solution plausibly uses.
var std = map[string]string{
	"bits": "math/bits", "bufio": "bufio", "bytes": "bytes", "cmp": "cmp", "errors": "errors",
	"fmt": "fmt", "heap": "container/heap", "list": "container/list", "maps": "maps",
	"math": "math", "rand": "math/rand", "regexp": "regexp", "ring": "container/ring",
	"slices": "slices", "sort": "sort", "strconv": "strconv", "strings": "strings",
	"unicode": "unicode", "utf8": "unicode/utf8",
}

func main() {
	src, err := os.ReadFile(os.Args[1])
	if err != nil {
		os.Exit(1)
	}
	out := src
	// A file that doesn't parse is left as it is: the compiler's error is the useful one.
	if f, err := parser.ParseFile(token.NewFileSet(), "", src, 0); err == nil {
		have := map[string]bool{}
		for _, im := range f.Imports {
			path, _ := strconv.Unquote(im.Path.Value)
			name := path[strings.LastIndex(path, "/")+1:]
			if im.Name != nil {
				name = im.Name.Name
			}
			have[name] = true
		}
		need := map[string]bool{}
		ast.Inspect(f, func(n ast.Node) bool {
			if sel, ok := n.(*ast.SelectorExpr); ok {
				// Obj is nil only for a name not declared in this file, so a local
				// variable called heap or list is never mistaken for the package.
				if id, ok := sel.X.(*ast.Ident); ok && id.Obj == nil && !have[id.Name] && std[id.Name] != "" {
					need[std[id.Name]] = true
				}
			}
			return true
		})
		if len(need) > 0 {
			paths := make([]string, 0, len(need))
			for p := range need {
				paths = append(paths, strconv.Quote(p))
			}
			sort.Strings(paths)
			at := int(f.Name.End()) - 1
			out = []byte(string(src[:at]) + "; import (" + strings.Join(paths, "; ") + ")" + string(src[at:]))
		}
	}
	if err := os.WriteFile(os.Args[2], out, 0o644); err != nil {
		os.Exit(1)
	}
}
