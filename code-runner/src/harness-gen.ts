import * as fs from "fs";
import * as path from "path";
import { ProblemMeta } from "./problem-meta";
import { SupportedLanguage } from "./types";

function loadHarness(filename: string): string {
  const candidates = [
    path.join(__dirname, "harnesses", filename),
    path.join(__dirname, "..", "src", "harnesses", filename),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf-8");
  }
  throw new Error(`Harness file not found: ${filename}`);
}

let _python3Harness: string | null = null;
function getPython3Harness(): string {
  if (!_python3Harness) _python3Harness = loadHarness("python3.py");
  return _python3Harness;
}

export function generateCode(
  language: SupportedLanguage,
  userCode: string,
  meta: ProblemMeta
): { code: string; filename: string } {
  switch (language) {
    case "python3":
      return generatePython3(userCode);
    case "cpp":
      return generateCpp(userCode, meta);
    case "java":
      return generateJava(userCode, meta);
    case "c":
      return generateC(userCode, meta);
  }
}

function generatePython3(userCode: string): { code: string; filename: string } {
  const combined = getPython3Harness().replace("{USER_CODE}", userCode);
  return { code: combined, filename: "run.py" };
}

// ── C++ helpers ──────────────────────────────────────────────────────

function cppTypeFor(t: string): string {
  const m: Record<string, string> = {
    "int": "int", "double": "double", "bool": "bool",
    "string": "string", "char": "char",
    "int[]": "vector<int>", "int[][]": "vector<vector<int>>",
    "string[]": "vector<string>", "char[]": "vector<char>",
    "char[][]": "vector<vector<char>>",
    "string[][]": "vector<vector<string>>",
    "ListNode": "ListNode*",
    "ListNode[]": "vector<ListNode*>",
    "TreeNode": "TreeNode*",
  };
  return m[t] || "auto";
}

function cppReadArg(varName: string, t: string): string {
  switch (t) {
    case "int":
      return `    string _s_${varName}; getline(cin, _s_${varName});\n    int ${varName} = stoi(_s_${varName});`;
    case "double":
      return `    string _s_${varName}; getline(cin, _s_${varName});\n    double ${varName} = stod(_s_${varName});`;
    case "bool":
      return `    string _s_${varName}; getline(cin, _s_${varName});\n    bool ${varName} = (_s_${varName} == "true");`;
    case "string":
      return `    string ${varName}; getline(cin, ${varName});\n    if (!${varName}.empty() && ${varName}.front()=='"') ${varName} = ${varName}.substr(1, ${varName}.size()-2);`;
    case "int[]":
      return `    string _s_${varName}; getline(cin, _s_${varName});\n    vector<int> ${varName} = _parseIntArr(_s_${varName});`;
    case "int[][]":
      return `    string _s_${varName}; getline(cin, _s_${varName});\n    vector<vector<int>> ${varName} = _parseInt2D(_s_${varName});`;
    case "char[]":
      return `    string _s_${varName}; getline(cin, _s_${varName});\n    vector<char> ${varName} = _parseCharArr(_s_${varName});`;
    case "char[][]":
      return `    string _s_${varName}; getline(cin, _s_${varName});\n    vector<vector<char>> ${varName} = _parseChar2D(_s_${varName});`;
    case "string[]":
      return `    string _s_${varName}; getline(cin, _s_${varName});\n    vector<string> ${varName} = _parseStrArr(_s_${varName});`;
    case "string[][]":
      return `    string _s_${varName}; getline(cin, _s_${varName});\n    vector<vector<string>> ${varName} = _parseStr2D(_s_${varName});`;
    case "ListNode":
      return `    string _s_${varName}; getline(cin, _s_${varName});\n    ListNode* ${varName} = _arrToList(_parseIntArr(_s_${varName}));`;
    case "ListNode[]":
      return `    string _s_${varName}; getline(cin, _s_${varName});\n    vector<ListNode*> ${varName} = _parseListArr(_s_${varName});`;
    case "TreeNode":
      return `    string _s_${varName}; getline(cin, _s_${varName});\n    TreeNode* ${varName} = _arrToTree(_s_${varName});`;
    default:
      return `    auto ${varName} = decltype(${cppTypeFor(t)})(); // unsupported type ${t}`;
  }
}

function cppPrintResult(expr: string, t: string): string {
  switch (t) {
    case "int": return `    cout << ${expr} << "\\n";`;
    case "double": return `    cout << fixed << setprecision(5) << ${expr} << "\\n";`;
    case "bool": return `    cout << (${expr} ? "true" : "false") << "\\n";`;
    case "string": return `    cout << "\\"" << ${expr} << "\\"" << "\\n";`;
    case "int[]": return `    _printIntArr(${expr});`;
    case "int[][]": return `    _printInt2D(${expr});`;
    case "string[]": return `    _printStrArr(${expr});`;
    case "char[]": return `    _printCharArr(${expr});`;
    case "string[][]": return `    _printStr2D(${expr});`;
    case "ListNode": return `    _printIntArr(_listToArr(${expr}));`;
    case "TreeNode": return `    cout << _treeToJson(${expr}) << "\\n";`;
    default: return `    cout << ${expr} << "\\n";`;
  }
}

const CPP_PARSE_HELPERS = `
struct ListNode {
    int val;
    ListNode *next;
    ListNode(int x=0) : val(x), next(nullptr) {}
};
struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode(int x=0) : val(x), left(nullptr), right(nullptr) {}
};

vector<int> _parseIntArr(const string& s) {
    vector<int> v;
    int i = 1, n = s.size();
    while (i < n && s[i] != ']') {
        if (s[i] == ',' || s[i] == ' ') { i++; continue; }
        int sign = 1; if (s[i]=='-') { sign=-1; i++; }
        int num = 0;
        while (i < n && isdigit(s[i])) num = num*10 + (s[i++]-'0');
        v.push_back(sign * num);
    }
    return v;
}

vector<vector<int>> _parseInt2D(const string& s) {
    vector<vector<int>> res;
    int i = 1, n = s.size();
    while (i < n) {
        if (s[i] == '[') {
            int j = i;
            int d = 0;
            while (j < n) {
                if (s[j]=='[') d++;
                if (s[j]==']') { d--; if(d==0) break; }
                j++;
            }
            res.push_back(_parseIntArr(s.substr(i, j-i+1)));
            i = j + 1;
        } else { i++; }
    }
    return res;
}

vector<char> _parseCharArr(const string& s) {
    vector<char> v;
    for (int i = 0; i < (int)s.size(); i++) {
        if (s[i] == '"' && i + 1 < (int)s.size()) {
            v.push_back(s[i + 1]);
            while (i < (int)s.size() && s[i] != '"') i++;
        }
    }
    if (v.empty()) {
        for (int i = 0; i < (int)s.size(); i++)
            if (isprint((unsigned char)s[i]) && s[i] != '[' && s[i] != ']' && s[i] != ',' && s[i] != '"' && s[i] != ' ')
                v.push_back(s[i]);
    }
    return v;
}

vector<vector<char>> _parseChar2D(const string& s) {
    vector<vector<char>> res;
    int i = 1, n = s.size();
    while (i < n) {
        if (s[i] == '[') {
            int j = i;
            int d = 0;
            while (j < n) {
                if (s[j]=='[') d++;
                if (s[j]==']') { d--; if(d==0) break; }
                j++;
            }
            res.push_back(_parseCharArr(s.substr(i, j-i+1)));
            i = j + 1;
        } else { i++; }
    }
    return res;
}

vector<string> _parseStrArr(const string& s) {
    vector<string> v;
    int i = 0, n = s.size();
    while (i < n) {
        if (s[i] == '"') {
            int j = i + 1;
            while (j < n && s[j] != '"') j++;
            v.push_back(s.substr(i+1, j-i-1));
            i = j + 1;
        } else { i++; }
    }
    return v;
}

vector<vector<string>> _parseStr2D(const string& s) {
    vector<vector<string>> res;
    int i = 1, n = s.size();
    while (i < n) {
        if (s[i] == '[') {
            int j = i;
            int d = 0;
            while (j < n) {
                if (s[j]=='[') d++;
                if (s[j]==']') { d--; if(d==0) break; }
                j++;
            }
            res.push_back(_parseStrArr(s.substr(i, j-i+1)));
            i = j + 1;
        } else { i++; }
    }
    return res;
}

ListNode* _arrToList(const vector<int>& arr) {
    ListNode dummy(0);
    ListNode* cur = &dummy;
    for (int v : arr) {
        cur->next = new ListNode(v);
        cur = cur->next;
    }
    return dummy.next;
}

vector<int> _listToArr(ListNode* node) {
    vector<int> out;
    int guard = 0;
    while (node && guard < 10000) {
        out.push_back(node->val);
        node = node->next;
        guard++;
    }
    return out;
}

vector<ListNode*> _parseListArr(const string& s) {
    vector<ListNode*> lists;
    auto matrix = _parseInt2D(s);
    for (const auto& arr : matrix) lists.push_back(_arrToList(arr));
    return lists;
}

TreeNode* _arrToTree(const string& s) {
    if (s == "[]" || s.empty()) return nullptr;
    vector<optional<int>> vals;
    string token = "";
    for (size_t i = 0; i < s.size(); i++) {
        char c = s[i];
        if (c == '[' || c == ' ' || c == '"') continue;
        if (c == ',' || c == ']') {
            if (!token.empty()) {
                if (token == "null") vals.push_back(nullopt);
                else vals.push_back(stoi(token));
                token.clear();
            }
        } else {
            token.push_back(c);
        }
    }
    if (vals.empty() || !vals[0].has_value()) return nullptr;
    TreeNode* root = new TreeNode(vals[0].value());
    queue<TreeNode*> q;
    q.push(root);
    int i = 1;
    while (!q.empty() && i < (int)vals.size()) {
        TreeNode* n = q.front(); q.pop();
        if (i < (int)vals.size() && vals[i].has_value()) {
            n->left = new TreeNode(vals[i].value());
            q.push(n->left);
        }
        i++;
        if (i < (int)vals.size() && vals[i].has_value()) {
            n->right = new TreeNode(vals[i].value());
            q.push(n->right);
        }
        i++;
    }
    return root;
}

TreeNode* _findNode(TreeNode* root, int val) {
    if (!root) return nullptr;
    queue<TreeNode*> q;
    q.push(root);
    while (!q.empty()) {
        TreeNode* n = q.front(); q.pop();
        if (n->val == val) return n;
        if (n->left) q.push(n->left);
        if (n->right) q.push(n->right);
    }
    return nullptr;
}

string _treeToJson(TreeNode* root) {
    if (!root) return "[]";
    vector<string> out;
    queue<TreeNode*> q;
    q.push(root);
    while (!q.empty()) {
        TreeNode* n = q.front(); q.pop();
        if (!n) {
            out.push_back("null");
        } else {
            out.push_back(to_string(n->val));
            q.push(n->left);
            q.push(n->right);
        }
    }
    while (!out.empty() && out.back() == "null") out.pop_back();
    string res = "[";
    for (size_t i = 0; i < out.size(); i++) {
        if (i) res += ",";
        res += out[i];
    }
    res += "]";
    return res;
}

void _printIntArr(const vector<int>& v) {
    cout << "[";
    for (size_t i=0;i<v.size();i++) { if(i) cout << ","; cout << v[i]; }
    cout << "]" << "\\n";
}

void _printInt2D(const vector<vector<int>>& vv) {
    cout << "[";
    for (size_t i=0;i<vv.size();i++) {
        if(i) cout << ",";
        cout << "[";
        for (size_t j=0;j<vv[i].size();j++) { if(j) cout << ","; cout << vv[i][j]; }
        cout << "]";
    }
    cout << "]" << "\\n";
}

void _printStrArr(const vector<string>& v) {
    cout << "[";
    for (size_t i=0;i<v.size();i++) { if(i) cout << ","; cout << "\\"" << v[i] << "\\""; }
    cout << "]" << "\\n";
}

void _printCharArr(const vector<char>& v) {
    cout << "[\\"";
    for (size_t i=0;i<v.size();i++) { if(i) cout << "\\",\\""; cout << v[i]; }
    cout << "\\"]" << "\\n";
}

void _printStr2D(const vector<vector<string>>& vv) {
    cout << "[";
    for (size_t i=0;i<vv.size();i++) {
        if(i) cout << ",";
        cout << "[";
        for (size_t j=0;j<vv[i].size();j++) { if(j) cout << ","; cout << "\\"" << vv[i][j] << "\\""; }
        cout << "]";
    }
    cout << "]" << "\\n";
}
`;

function generateCpp(
  userCode: string,
  meta: ProblemMeta
): { code: string; filename: string } {
  if (meta.isDesign) {
    const code = `#include <bits/stdc++.h>
using namespace std;

${userCode}

int main() {
    cout << "[]" << endl;
    return 0;
}
`;
    return { code, filename: "solution.cpp" };
  }

  const params = meta.params || [];
  const retType = meta.returnType || "void";
  const fnName = meta.methodName || "solve";

  const readArgs = params.map((p) => cppReadArg(p.name, p.type)).join("\n");
  const argNames = params.map((p) => p.name).join(", ");

  let callAndPrint: string;
  if (meta.methodName === "hasCycle" && params.length === 2 && params[0].type === "int[]" && params[1].type === "int") {
    callAndPrint = `    ListNode* _cycleHead = _arrToList(${params[0].name});\n    if (${params[1].name} >= 0) {\n      ListNode* _tail = _cycleHead; ListNode* _join = nullptr; int _idx = 0;\n      while (_tail && _tail->next) { if (_idx == ${params[1].name}) _join = _tail; _tail = _tail->next; _idx++; }\n      if (_tail) { if (_idx == ${params[1].name}) _join = _tail; if (_join) _tail->next = _join; }\n    }\n    bool _result = sol.${fnName}(_cycleHead);\n    cout << (_result ? "true" : "false") << "\\n";`;
  } else if (meta.methodName === "lowestCommonAncestor" && params.length === 3 && params[0].type === "TreeNode" && params[1].type === "int" && params[2].type === "int") {
    callAndPrint = `    TreeNode* _p = _findNode(${params[0].name}, ${params[1].name});\n    TreeNode* _q = _findNode(${params[0].name}, ${params[2].name});\n    auto _result = sol.${fnName}(${params[0].name}, _p, _q);\n    cout << (_result ? _result->val : 0) << "\\n";`;
  } else if (retType === "void") {
    const firstMutable = params.find(
      (p) => p.type === "char[]" || p.type === "int[]"
    );
    callAndPrint = `    sol.${fnName}(${argNames});\n`;
    if (firstMutable) {
      callAndPrint += cppPrintResult(firstMutable.name, firstMutable.type);
    } else {
      callAndPrint += `    cout << "null" << "\\n";`;
    }
  } else {
    callAndPrint = `    ${cppTypeFor(retType)} _result = sol.${fnName}(${argNames});\n${cppPrintResult("_result", retType)}`;
  }

  const code = `#include <bits/stdc++.h>
using namespace std;
${CPP_PARSE_HELPERS}
${userCode}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    Solution sol;
    string _sep;
    while (cin.good()) {
        // Peek to check for EOF
        if (cin.peek() == EOF) break;
${readArgs}
${callAndPrint}
        getline(cin, _sep); // read "---" separator
    }
    return 0;
}
`;
  return { code, filename: "solution.cpp" };
}

// ── Java helpers ─────────────────────────────────────────────────────

function javaTypeFor(t: string): string {
  const m: Record<string, string> = {
    "int": "int", "double": "double", "bool": "boolean",
    "string": "String", "int[]": "int[]", "int[][]": "int[][]",
    "string[]": "String[]", "char[]": "char[]", "char[][]": "char[][]",
    "string[][]": "String[][]", "ListNode": "ListNode", "ListNode[]": "ListNode[]", "TreeNode": "TreeNode",
  };
  return m[t] || "Object";
}

function javaReadArg(varName: string, t: string): string {
  switch (t) {
    case "int":
      return `            int ${varName} = Integer.parseInt(br.readLine().trim());`;
    case "double":
      return `            double ${varName} = Double.parseDouble(br.readLine().trim());`;
    case "bool":
      return `            boolean ${varName} = br.readLine().trim().equals("true");`;
    case "string":
      return `            String ${varName} = br.readLine().trim(); if(${varName}.startsWith("\\"")) ${varName}=${varName}.substring(1,${varName}.length()-1);`;
    case "int[]":
      return `            int[] ${varName} = _parseIntArr(br.readLine().trim());`;
    case "int[][]":
      return `            int[][] ${varName} = _parseInt2D(br.readLine().trim());`;
    case "char[]":
      return `            char[] ${varName} = _parseCharArr(br.readLine().trim());`;
    case "char[][]":
      return `            char[][] ${varName} = _parseChar2D(br.readLine().trim());`;
    case "string[]":
      return `            String[] ${varName} = _parseStrArr(br.readLine().trim());`;
    case "string[][]":
      return `            String[][] ${varName} = _parseStr2D(br.readLine().trim());`;
    case "ListNode":
      return `            ListNode ${varName} = _arrToList(_parseIntArr(br.readLine().trim()));`;
    case "ListNode[]":
      return `            ListNode[] ${varName} = _parseListArr(br.readLine().trim());`;
    case "TreeNode":
      return `            TreeNode ${varName} = _arrToTree(br.readLine().trim());`;
    default:
      return `            Object ${varName} = null; // unsupported type ${t}`;
  }
}

function javaPrintResult(expr: string, t: string): string {
  switch (t) {
    case "int": return `            System.out.println(${expr});`;
    case "double": return `            System.out.printf("%.5f%n", ${expr});`;
    case "bool": return `            System.out.println(${expr} ? "true" : "false");`;
    case "string": return `            System.out.println("\\"" + ${expr} + "\\"");`;
    case "int[]": return `            System.out.println(java.util.Arrays.toString(${expr}).replace(" ",""));`;
    case "int[][]": return `            System.out.println(java.util.Arrays.deepToString(${expr}).replace(" ",""));`;
    case "string[]": return `            { StringBuilder _sb=new StringBuilder("["); for(int _i=0;_i<${expr}.length;_i++){if(_i>0)_sb.append(",");_sb.append("\\"").append(${expr}[_i]).append("\\"");} _sb.append("]"); System.out.println(_sb); }`;
    case "string[][]": return `            _printStr2D(${expr});`;
    case "ListNode": return `            System.out.println(_listToJson(${expr}));`;
    case "TreeNode": return `            System.out.println(_treeToJson(${expr}));`;
    default: return `            System.out.println(String.valueOf(${expr}));`;
  }
}

const JAVA_DS_TYPES = `
class ListNode {
    int val;
    ListNode next;
    ListNode(int v) { this.val = v; }
}
class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode(int v) { this.val = v; }
}
`;

const JAVA_PARSE_HELPERS = `
    static int[] _parseIntArr(String s) {
        if (s.equals("[]")) return new int[0];
        s = s.substring(1, s.length()-1);
        String[] parts = s.split(",");
        int[] arr = new int[parts.length];
        for (int i=0;i<parts.length;i++) arr[i]=Integer.parseInt(parts[i].trim());
        return arr;
    }

    static int[][] _parseInt2D(String s) {
        if (s.equals("[]")) return new int[0][];
        List<int[]> list = new ArrayList<>();
        int i=1;
        while (i<s.length()) {
            if (s.charAt(i)=='[') {
                int j=s.indexOf(']',i);
                list.add(_parseIntArr(s.substring(i,j+1)));
                i=j+1;
            } else i++;
        }
        return list.toArray(new int[0][]);
    }

    static char[] _parseCharArr(String s) {
        List<Character> list = new ArrayList<>();
        for (int i=0;i<s.length();i++) {
            if (s.charAt(i)=='"' && i+1<s.length()) {
                list.add(s.charAt(i+1));
                i += 2;
                while (i<s.length() && s.charAt(i)!='"') i++;
            }
        }
        if (list.isEmpty()) {
            for (int i=0;i<s.length();i++) {
                char c=s.charAt(i);
                if (c!='['&&c!=']'&&c!=','&&c!='"'&&!Character.isWhitespace(c)) list.add(c);
            }
        }
        char[] arr = new char[list.size()];
        for (int i=0;i<list.size();i++) arr[i]=list.get(i);
        return arr;
    }

    static char[][] _parseChar2D(String s) {
        List<char[]> list = new ArrayList<>();
        int i=1;
        while (i<s.length()) {
            if (s.charAt(i)=='[') {
                int j=s.indexOf(']',i);
                list.add(_parseCharArr(s.substring(i,j+1)));
                i=j+1;
            } else i++;
        }
        return list.toArray(new char[0][]);
    }

    static String[] _parseStrArr(String s) {
        List<String> list = new ArrayList<>();
        int i=0;
        while (i<s.length()) {
            if (s.charAt(i)=='"') {
                int j=s.indexOf('"',i+1);
                list.add(s.substring(i+1,j));
                i=j+1;
            } else i++;
        }
        return list.toArray(new String[0]);
    }

    static String[][] _parseStr2D(String s) {
        if (s.equals("[]")) return new String[0][];
        List<String[]> list = new ArrayList<>();
        int i=1;
        while (i<s.length()) {
            if (s.charAt(i)=='[') {
                int d=0, j=i;
                while (j<s.length()) {
                    if (s.charAt(j)=='[') d++;
                    if (s.charAt(j)==']') { d--; if (d==0) break; }
                    j++;
                }
                list.add(_parseStrArr(s.substring(i,j+1)));
                i=j+1;
            } else i++;
        }
        return list.toArray(new String[0][]);
    }

    static ListNode _arrToList(int[] arr) {
        ListNode dummy = new ListNode(0), cur = dummy;
        for (int v : arr) { cur.next = new ListNode(v); cur = cur.next; }
        return dummy.next;
    }

    static ListNode[] _parseListArr(String s) {
        int[][] matrix = _parseInt2D(s);
        ListNode[] out = new ListNode[matrix.length];
        for (int i=0;i<matrix.length;i++) out[i] = _arrToList(matrix[i]);
        return out;
    }

    static TreeNode _arrToTree(String s) {
        if (s.equals("[]")) return null;
        List<Integer> vals = new ArrayList<>();
        StringBuilder token = new StringBuilder();
        for (int i=0;i<s.length();i++) {
            char c = s.charAt(i);
            if (c=='[' || c=='"' || Character.isWhitespace(c)) continue;
            if (c==',' || c==']') {
                if (token.length()>0) {
                    String t = token.toString();
                    vals.add("null".equals(t) ? null : Integer.parseInt(t));
                    token.setLength(0);
                }
            } else token.append(c);
        }
        if (vals.isEmpty() || vals.get(0)==null) return null;
        TreeNode root = new TreeNode(vals.get(0));
        Queue<TreeNode> q = new ArrayDeque<>();
        q.offer(root);
        int i=1;
        while(!q.isEmpty() && i<vals.size()) {
            TreeNode n = q.poll();
            if (i<vals.size() && vals.get(i)!=null) { n.left = new TreeNode(vals.get(i)); q.offer(n.left); }
            i++;
            if (i<vals.size() && vals.get(i)!=null) { n.right = new TreeNode(vals.get(i)); q.offer(n.right); }
            i++;
        }
        return root;
    }

    static TreeNode _findNode(TreeNode root, int target) {
        if (root == null) return null;
        Queue<TreeNode> q = new ArrayDeque<>();
        q.offer(root);
        while(!q.isEmpty()) {
            TreeNode n = q.poll();
            if (n.val == target) return n;
            if (n.left != null) q.offer(n.left);
            if (n.right != null) q.offer(n.right);
        }
        return null;
    }

    static String _listToJson(ListNode head) {
        StringBuilder sb = new StringBuilder("[");
        int guard = 0;
        while (head != null && guard < 10000) {
            if (guard > 0) sb.append(",");
            sb.append(head.val);
            head = head.next;
            guard++;
        }
        sb.append("]");
        return sb.toString();
    }

    static String _treeToJson(TreeNode root) {
        if (root == null) return "[]";
        List<String> out = new ArrayList<>();
        Queue<TreeNode> q = new ArrayDeque<>();
        q.offer(root);
        while(!q.isEmpty()) {
            TreeNode n = q.poll();
            if (n == null) out.add("null");
            else {
                out.add(String.valueOf(n.val));
                q.offer(n.left);
                q.offer(n.right);
            }
        }
        int j = out.size() - 1;
        while (j >= 0 && "null".equals(out.get(j))) j--;
        StringBuilder sb = new StringBuilder("[");
        for (int k=0; k<=j; k++) {
            if (k > 0) sb.append(",");
            sb.append(out.get(k));
        }
        sb.append("]");
        return sb.toString();
    }

    static void _printStr2D(String[][] vv) {
        StringBuilder sb = new StringBuilder("[");
        for (int i=0;i<vv.length;i++) {
            if (i>0) sb.append(",");
            sb.append("[");
            for (int j=0;j<vv[i].length;j++) {
                if (j>0) sb.append(",");
                sb.append("\\"").append(vv[i][j]).append("\\"");
            }
            sb.append("]");
        }
        sb.append("]");
        System.out.println(sb.toString());
    }
`;

function generateJava(
  userCode: string,
  meta: ProblemMeta
): { code: string; filename: string } {
  if (meta.isDesign) {
    const code = `import java.util.*;
import java.io.*;

${JAVA_DS_TYPES}
${userCode}

public class Main {
    public static void main(String[] args) {
        System.out.println("[]");
    }
}
`;
    return { code, filename: "Main.java" };
  }

  const params = meta.params || [];
  const retType = meta.returnType || "void";
  const fnName = meta.methodName || "solve";

  const readArgs = params.map((p) => javaReadArg(p.name, p.type)).join("\n");
  const argNames = params.map((p) => p.name).join(", ");

  let callLine = retType === "void"
    ? `            sol.${fnName}(${argNames});`
    : `            ${javaTypeFor(retType)} _result = sol.${fnName}(${argNames});`;

  let printLine: string;
  if (meta.methodName === "hasCycle" && params.length === 2 && params[0].type === "int[]" && params[1].type === "int") {
    callLine = `            ListNode _cycleHead = _arrToList(${params[0].name});\n            if (${params[1].name} >= 0) {\n                ListNode _tail = _cycleHead, _join = null; int _idx = 0;\n                while (_tail != null && _tail.next != null) { if (_idx == ${params[1].name}) _join = _tail; _tail = _tail.next; _idx++; }\n                if (_tail != null) { if (_idx == ${params[1].name}) _join = _tail; if (_join != null) _tail.next = _join; }\n            }\n            boolean _result = sol.${fnName}(_cycleHead);`;
    printLine = `            System.out.println(_result ? "true" : "false");`;
  } else if (meta.methodName === "lowestCommonAncestor" && params.length === 3 && params[0].type === "TreeNode" && params[1].type === "int" && params[2].type === "int") {
    callLine = `            TreeNode _p = _findNode(${params[0].name}, ${params[1].name});\n            TreeNode _q = _findNode(${params[0].name}, ${params[2].name});\n            TreeNode _result = sol.${fnName}(${params[0].name}, _p, _q);`;
    printLine = `            System.out.println(_result == null ? "0" : String.valueOf(_result.val));`;
  } else if (retType === "void") {
    const first = params.find((p) => p.type === "char[]" || p.type === "int[]");
    printLine = first
      ? javaPrintResult(first.name, first.type)
      : `            System.out.println("null");`;
  } else {
    printLine = javaPrintResult("_result", retType);
  }

  const code = `import java.util.*;
import java.io.*;

${JAVA_DS_TYPES}
${userCode}

public class Main {
${JAVA_PARSE_HELPERS}
    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        Solution sol = new Solution();
        String _sep;
        while (br.ready()) {
${readArgs}
${callLine}
${printLine}
            _sep = br.readLine(); // read "---" separator
        }
    }
}
`;
  return { code, filename: "Main.java" };
}

// ── C helpers ────────────────────────────────────────────────────────

function cReadArg(varName: string, t: string): string {
  switch (t) {
    case "int":
      return `    char _buf_${varName}[64]; fgets(_buf_${varName},64,stdin);\n    int ${varName} = atoi(_buf_${varName});`;
    case "double":
      return `    char _buf_${varName}[64]; fgets(_buf_${varName},64,stdin);\n    double ${varName} = atof(_buf_${varName});`;
    case "bool":
      return `    char _buf_${varName}[16]; fgets(_buf_${varName},16,stdin);\n    bool ${varName} = (strncmp(_buf_${varName},"true",4)==0);`;
    case "int[]":
      return [
        `    char _buf_${varName}[4096]; fgets(_buf_${varName},4096,stdin);`,
        `    int _cap_${varName}=64, ${varName}Size=0;`,
        `    int* ${varName} = (int*)malloc(_cap_${varName}*sizeof(int));`,
        `    { char*p=_buf_${varName}; while(*p&&*p!='[')p++; if(*p)p++;`,
        `      while(*p&&*p!=']') {`,
        `        while(*p&&(*p==','||*p==' '))p++;`,
        `        if(*p==']'||!*p)break;`,
        `        ${varName}[${varName}Size++]=strtol(p,&p,10);`,
        `        if(${varName}Size>=_cap_${varName}){_cap_${varName}*=2;${varName}=(int*)realloc(${varName},_cap_${varName}*sizeof(int));}`,
        `      }`,
        `    }`,
      ].join("\n");
    case "string":
      return [
        `    char _buf_${varName}[4096]; fgets(_buf_${varName},4096,stdin);`,
        `    char* ${varName} = _buf_${varName};`,
        `    { int _l=strlen(${varName}); if(_l>0&&${varName}[_l-1]=='\\n')${varName}[--_l]='\\0';`,
        `      if(_l>1&&${varName}[0]=='"'){${varName}++;${varName}[_l-2]='\\0';} }`,
      ].join("\n");
    case "char[]":
      return [
        `    char _buf_${varName}[4096]; fgets(_buf_${varName},4096,stdin);`,
        `    int ${varName}Size = 0;`,
        `    char* ${varName} = (char*)malloc(4096);`,
        `    for(char* _p=_buf_${varName}; *_p; _p++){`,
        `      if(*_p=='"' && *(_p+1) && *(_p+1)!='"'){ ${varName}[${varName}Size++]=*(_p+1); _p++; while(*_p && *_p!='"') _p++; }`,
        `    }`,
        `    ${varName}[${varName}Size]='\\0';`,
      ].join("\n");
    case "int[][]":
      return [
        `    char _buf_${varName}[8192]; fgets(_buf_${varName},8192,stdin);`,
        `    int ${varName}Rows=0; for(char* _p=_buf_${varName}; *_p; _p++) if(*_p=='[' && *(_p+1)!='[') ${varName}Rows++;`,
        `    int** ${varName} = (int**)malloc(${varName}Rows * sizeof(int*));`,
        `    int* ${varName}ColSize = (int*)calloc(${varName}Rows, sizeof(int));`,
        `    { int _r=-1; char* _p=_buf_${varName};`,
        `      while(*_p){`,
        `        if(*_p=='[' && *(_p+1)!='['){ _r++; int _cap=16, _c=0; ${varName}[_r]=(int*)malloc(_cap*sizeof(int)); _p++;`,
        `          while(*_p && *_p!=']'){ while(*_p&&(*_p==','||*_p==' ')) _p++; if(*_p==']'||!*_p) break;`,
        `            if(_c>=_cap){_cap*=2; ${varName}[_r]=(int*)realloc(${varName}[_r],_cap*sizeof(int));}`,
        `            ${varName}[_r][_c++] = (int)strtol(_p,&_p,10); }`,
        `          ${varName}ColSize[_r]=_c;`,
        `        } else _p++;`,
        `      }`,
        `    }`,
      ].join("\n");
    case "string[]":
      return [
        `    char _buf_${varName}[8192]; fgets(_buf_${varName},8192,stdin);`,
        `    int ${varName}Size=0, _cap_${varName}=16;`,
        `    char** ${varName} = (char**)malloc(_cap_${varName} * sizeof(char*));`,
        `    for(char* _p=_buf_${varName}; *_p; _p++){`,
        `      if(*_p=='"' && *(_p+1)){ char* _s=++_p; while(*_p && *_p!='"') _p++; int _len=(int)(_p-_s);`,
        `        if(${varName}Size>=_cap_${varName}){_cap_${varName}*=2; ${varName}=(char**)realloc(${varName}, _cap_${varName}*sizeof(char*));}`,
        `        ${varName}[${varName}Size]=(char*)malloc(_len+1); strncpy(${varName}[${varName}Size], _s, _len); ${varName}[${varName}Size][_len]='\\0';`,
        `        ${varName}Size++; }`,
        `    }`,
      ].join("\n");
    case "ListNode":
      return [
        `    char _buf_${varName}[8192]; fgets(_buf_${varName},8192,stdin);`,
        `    int _cap_${varName}=64, _size_${varName}=0;`,
        `    int* _arr_${varName}=(int*)malloc(_cap_${varName}*sizeof(int));`,
        `    { char* p=_buf_${varName}; while(*p&&*p!='[') p++; if(*p) p++;`,
        `      while(*p&&*p!=']'){ while(*p&&(*p==','||*p==' ')) p++; if(*p==']'||!*p) break;`,
        `        if(_size_${varName}>=_cap_${varName}){_cap_${varName}*=2; _arr_${varName}=(int*)realloc(_arr_${varName},_cap_${varName}*sizeof(int));}`,
        `        _arr_${varName}[_size_${varName}++] = (int)strtol(p,&p,10); } }`,
        `    struct ListNode* ${varName} = _arrToList(_arr_${varName}, _size_${varName});`,
      ].join("\n");
    case "ListNode[]":
      return [
        `    char _buf_${varName}[8192]; fgets(_buf_${varName},8192,stdin);`,
        `    int _rows_${varName}=0; for(char* _p=_buf_${varName}; *_p; _p++) if(*_p=='[' && *(_p+1)!='[') _rows_${varName}++;`,
        `    struct ListNode** ${varName} = (struct ListNode**)malloc(_rows_${varName} * sizeof(struct ListNode*));`,
        `    int ${varName}Size = _rows_${varName};`,
        `    { int _r=-1; char* _p=_buf_${varName};`,
        `      while(*_p){`,
        `        if(*_p=='[' && *(_p+1)!='['){ _r++; int _cap=16, _c=0; int* _tmp=(int*)malloc(_cap*sizeof(int)); _p++;`,
        `          while(*_p && *_p!=']'){ while(*_p&&(*_p==','||*_p==' ')) _p++; if(*_p==']'||!*_p) break;`,
        `            if(_c>=_cap){_cap*=2; _tmp=(int*)realloc(_tmp,_cap*sizeof(int));}`,
        `            _tmp[_c++] = (int)strtol(_p,&_p,10); }`,
        `          ${varName}[_r] = _arrToList(_tmp, _c);`,
        `        } else _p++;`,
        `      }`,
        `    }`,
      ].join("\n");
    case "TreeNode":
      return [
        `    char _buf_${varName}[8192]; fgets(_buf_${varName},8192,stdin);`,
        `    struct TreeNode* ${varName} = _parseTree(_buf_${varName});`,
      ].join("\n");
    case "char[][]":
      return [
        `    char _buf_${varName}[8192]; fgets(_buf_${varName},8192,stdin);`,
        `    int ${varName}Rows=0; for(char* _p=_buf_${varName}; *_p; _p++) if(*_p=='[' && *(_p+1)!='[') ${varName}Rows++;`,
        `    char** ${varName} = (char**)malloc(${varName}Rows * sizeof(char*));`,
        `    int* ${varName}ColSize = (int*)calloc(${varName}Rows, sizeof(int));`,
        `    { int _r=-1; char* _p=_buf_${varName};`,
        `      while(*_p){`,
        `        if(*_p=='[' && *(_p+1)!='['){ _r++; int _cap=16, _c=0; ${varName}[_r]=(char*)malloc(_cap); _p++;`,
        `          while(*_p && *_p!=']'){`,
        `            if(*_p=='"' && *(_p+1) && *(_p+1)!='"'){ if(_c>=_cap){_cap*=2; ${varName}[_r]=(char*)realloc(${varName}[_r],_cap);} ${varName}[_r][_c++]=*(_p+1); _p++; while(*_p && *_p!='"') _p++; }`,
        `            _p++;`,
        `          }`,
        `          ${varName}ColSize[_r]=_c;`,
        `        } else _p++;`,
        `      }`,
        `    }`,
      ].join("\n");
    default:
      return `    // unsupported C type: ${t} for ${varName}`;
  }
}

function cPrintResult(expr: string, t: string, sizeVar?: string): string {
  switch (t) {
    case "int": return `    printf("%d\\n", ${expr});`;
    case "double": return `    printf("%.5f\\n", ${expr});`;
    case "bool": return `    printf("%s\\n", ${expr} ? "true" : "false");`;
    case "int[]":
      return [
        `    printf("[");`,
        `    for(int _i=0;_i<${sizeVar || "0"};_i++){if(_i)printf(",");printf("%d",${expr}[_i]);}`,
        `    printf("]\\n");`,
      ].join("\n");
    case "int[][]":
      return [
        `    printf("[");`,
        `    for(int _r=0;_r<${sizeVar || "0"};_r++){ if(_r) printf(","); printf("[");`,
        `      for(int _c=0;_c<${expr}ColSize[_r];_c++){ if(_c) printf(","); printf("%d", ${expr}[_r][_c]); }`,
        `      printf("]"); }`,
        `    printf("]\\n");`,
      ].join("\n");
    case "ListNode":
      return `    _printList(${expr});`;
    case "TreeNode":
      return `    _printTree(${expr});`;
    case "string[][]":
      return [
        `    printf("[");`,
        `    for(int _r=0;_r<${sizeVar || "0"};_r++){`,
        `      if(_r) printf(","); printf("[");`,
        `      for(int _c=0;_c<${expr}ColSize[_r];_c++){ if(_c) printf(","); printf("\\"%s\\"", ${expr}[_r][_c]); }`,
        `      printf("]");`,
        `    }`,
        `    printf("]\\n");`,
      ].join("\n");
    default: return `    printf("null\\n");`;
  }
}

function generateC(
  userCode: string,
  meta: ProblemMeta
): { code: string; filename: string } {
  const unsupportedTypes = new Set([
    "TreeNode[]",
  ]);
  const hasUnsupported =
    (meta.params || []).some((p) => unsupportedTypes.has(p.type)) ||
    unsupportedTypes.has(meta.returnType || "");

  if (hasUnsupported) {
    const code = `#include <stdio.h>
int main() {
    char line[4096];
    while (fgets(line, sizeof(line), stdin)) {
        if (line[0] == '-' && line[1] == '-' && line[2] == '-') {
            printf("{\\"__error\\":\\"Unsupported type for C harness\\"}\\n");
        }
    }
    return 0;
}
`;
    return { code, filename: "solution.c" };
  }

  if (meta.isDesign) {
    const code = `#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdbool.h>\n\n${userCode}\n\nint main(){printf("[]\\n");return 0;}\n`;
    return { code, filename: "solution.c" };
  }

  const params = meta.params || [];
  const retType = meta.returnType || "void";
  const fnName = meta.methodName || "solve";

  const readArgs = params.map((p) => cReadArg(p.name, p.type)).join("\n");

  const cArgList = params
    .map((p) => {
      if (p.type === "int[]") return `${p.name}, ${p.name}Size`;
      if (p.type === "char[]") return `${p.name}, ${p.name}Size`;
      if (p.type === "int[][]") return `${p.name}, ${p.name}Rows, ${p.name}ColSize`;
      if (p.type === "string[]") return `${p.name}, ${p.name}Size`;
      if (p.type === "char[][]") return `${p.name}, ${p.name}Rows, ${p.name}ColSize`;
      if (p.type === "ListNode[]") return `${p.name}, ${p.name}Size`;
      return p.name;
    })
    .join(", ");

  let callAndPrint: string;
  if (retType === "void") {
    const firstMutable = params.find((p) => p.type === "int[]" || p.type === "int[][]" || p.type === "char[]");
    callAndPrint = `    ${fnName}(${cArgList});\n`;
    if (firstMutable?.type === "int[]") {
      callAndPrint += cPrintResult(firstMutable.name, "int[]", `${firstMutable.name}Size`);
    } else if (firstMutable?.type === "int[][]") {
      callAndPrint += cPrintResult(firstMutable.name, "int[][]", `${firstMutable.name}Rows`);
    } else {
      callAndPrint += `    printf("null\\n");`;
    }
  } else if (retType === "int") {
    if (meta.methodName === "lowestCommonAncestor" && params.length === 3 && params[0].type === "TreeNode" && params[1].type === "int" && params[2].type === "int") {
      callAndPrint = `    struct TreeNode* _p = _findTreeNode(${params[0].name}, ${params[1].name});\n    struct TreeNode* _q = _findTreeNode(${params[0].name}, ${params[2].name});\n    struct TreeNode* _n = ${fnName}(${params[0].name}, _p, _q);\n    int _result = _n ? _n->val : 0;\n${cPrintResult("_result", "int")}`;
    } else {
      callAndPrint = `    int _result = ${fnName}(${cArgList});\n${cPrintResult("_result", "int")}`;
    }
  } else if (retType === "bool") {
    callAndPrint = `    bool _result = ${fnName}(${cArgList});\n${cPrintResult("_result", "bool")}`;
  } else if (retType === "double") {
    callAndPrint = `    double _result = ${fnName}(${cArgList});\n${cPrintResult("_result", "double")}`;
  } else if (retType === "int[]") {
    callAndPrint = `    int _retSize = 0;\n    int* _result = ${fnName}(${cArgList}, &_retSize);\n${cPrintResult("_result", "int[]", "_retSize")}`;
  } else if (retType === "ListNode") {
    if (meta.methodName === "lowestCommonAncestor" && params.length === 3 && params[0].type === "TreeNode" && params[1].type === "int" && params[2].type === "int") {
      callAndPrint = `    struct TreeNode* _p = _findTreeNode(${params[0].name}, ${params[1].name});\n    struct TreeNode* _q = _findTreeNode(${params[0].name}, ${params[2].name});\n    struct TreeNode* _result = ${fnName}(${params[0].name}, _p, _q);\n    printf("%d\\n", _result ? _result->val : 0);`;
    } else {
      callAndPrint = `    struct ListNode* _result = ${fnName}(${cArgList});\n${cPrintResult("_result", "ListNode")}`;
    }
  } else if (retType === "TreeNode") {
    callAndPrint = `    struct TreeNode* _result = ${fnName}(${cArgList});\n${cPrintResult("_result", "TreeNode")}`;
  } else if (retType === "int[][]") {
    callAndPrint = `    int _retSize = 0;\n    int* _resultColSize = NULL;\n    int** _result = ${fnName}(${cArgList}, &_retSize, &_resultColSize);\n${cPrintResult("_result", "int[][]", "_retSize")}`;
  } else if (retType === "string[][]") {
    callAndPrint = `    int _retSize = 0;\n    int* _resultColSize = NULL;\n    char*** _result = ${fnName}(${cArgList}, &_retSize, &_resultColSize);\n${cPrintResult("_result", "string[][]", "_retSize")}`;
  } else {
    callAndPrint = `    // unsupported return type: ${retType}\n    printf("null\\n");`;
  }

  const code = `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>

struct ListNode { int val; struct ListNode* next; };
struct TreeNode { int val; struct TreeNode* left; struct TreeNode* right; };

struct ListNode* _arrToList(int* arr, int n) {
    struct ListNode* head = NULL; struct ListNode* tail = NULL;
    for (int i = 0; i < n; i++) {
        struct ListNode* node = (struct ListNode*)malloc(sizeof(struct ListNode));
        node->val = arr[i]; node->next = NULL;
        if (!head) head = node; else tail->next = node;
        tail = node;
    }
    return head;
}
void _printList(struct ListNode* head) {
    printf("[");
    int first = 1, guard = 0;
    while (head && guard < 10000) {
        if (!first) printf(",");
        printf("%d", head->val);
        first = 0;
        head = head->next;
        guard++;
    }
    printf("]\\n");
}
struct TreeNode* _parseTree(char* s) {
    int cap = 256, n = 0;
    int* vals = (int*)malloc(cap * sizeof(int));
    int* isNull = (int*)malloc(cap * sizeof(int));
    char token[64]; int tlen = 0;
    for (char* p = s; *p; p++) {
        if (*p == '[' || *p == ' ' || *p == '"') continue;
        if (*p == ',' || *p == ']') {
            if (tlen > 0) {
                token[tlen] = '\\0';
                if (n >= cap) { cap *= 2; vals = (int*)realloc(vals, cap * sizeof(int)); isNull = (int*)realloc(isNull, cap * sizeof(int)); }
                if (strcmp(token, "null") == 0) { isNull[n] = 1; vals[n] = 0; }
                else { isNull[n] = 0; vals[n] = atoi(token); }
                n++; tlen = 0;
            }
        } else {
            if (tlen < 63) token[tlen++] = *p;
        }
    }
    if (n == 0 || isNull[0]) return NULL;
    struct TreeNode** nodes = (struct TreeNode**)calloc(n, sizeof(struct TreeNode*));
    for (int i = 0; i < n; i++) {
        if (!isNull[i]) { nodes[i] = (struct TreeNode*)malloc(sizeof(struct TreeNode)); nodes[i]->val = vals[i]; nodes[i]->left = nodes[i]->right = NULL; }
    }
    int child = 1;
    for (int i = 0; i < n && child < n; i++) {
        if (!nodes[i]) continue;
        if (child < n) nodes[i]->left = nodes[child++];
        if (child < n) nodes[i]->right = nodes[child++];
    }
    return nodes[0];
}
void _printTree(struct TreeNode* root) {
    if (!root) { printf("[]\\n"); return; }
    struct TreeNode** q = (struct TreeNode**)malloc(32768 * sizeof(struct TreeNode*));
    int h = 0, t = 0; q[t++] = root;
    char out[65536]; int len = 0; out[len++] = '[';
    int lastNonNull = -1;
    char parts[2048][16]; int pc = 0;
    while (h < t && pc < 2000) {
        struct TreeNode* n = q[h++];
        if (!n) { strcpy(parts[pc], "null"); pc++; continue; }
        snprintf(parts[pc], sizeof(parts[pc]), "%d", n->val); lastNonNull = pc; pc++;
        q[t++] = n->left; q[t++] = n->right;
    }
    for (int i = 0; i <= lastNonNull; i++) {
        if (i) out[len++] = ',';
        int l = (int)strlen(parts[i]); memcpy(out + len, parts[i], l); len += l;
    }
    out[len++] = ']'; out[len++] = '\\n'; out[len] = '\\0';
    printf("%s", out);
}
struct TreeNode* _findTreeNode(struct TreeNode* root, int target) {
    if (!root) return NULL;
    struct TreeNode* q[32768]; int h = 0, t = 0; q[t++] = root;
    while (h < t) {
        struct TreeNode* n = q[h++];
        if (n->val == target) return n;
        if (n->left) q[t++] = n->left;
        if (n->right) q[t++] = n->right;
    }
    return NULL;
}

${userCode}

int main() {
    char _sep[8];
    while (1) {
        int _ch = fgetc(stdin);
        if (_ch == EOF) break;
        ungetc(_ch, stdin);
${readArgs}
${callAndPrint}
        if(!fgets(_sep,8,stdin)) break; // read "---" separator
    }
    return 0;
}
`;
  return { code, filename: "solution.c" };
}
