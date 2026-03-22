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
    default:
      return `    // unsupported type ${t} for ${varName}`;
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
    default: return `    cout << ${expr} << "\\n";`;
  }
}

const CPP_PARSE_HELPERS = `
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
    for (int i = 0; i < (int)s.size(); i++)
        if (isalpha(s[i]) || isdigit(s[i])) v.push_back(s[i]);
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
  if (retType === "void") {
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
    default:
      return `            // unsupported type ${t} for ${varName}`;
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
    default: return `            System.out.println(String.valueOf(${expr}));`;
  }
}

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
            char c=s.charAt(i);
            if (Character.isLetterOrDigit(c)) list.add(c);
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
`;

function generateJava(
  userCode: string,
  meta: ProblemMeta
): { code: string; filename: string } {
  if (meta.isDesign) {
    const code = `import java.util.*;
import java.io.*;

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

  const callLine = retType === "void"
    ? `            sol.${fnName}(${argNames});`
    : `            ${javaTypeFor(retType)} _result = sol.${fnName}(${argNames});`;

  let printLine: string;
  if (retType === "void") {
    const first = params.find((p) => p.type === "char[]" || p.type === "int[]");
    printLine = first
      ? javaPrintResult(first.name, first.type)
      : `            System.out.println("null");`;
  } else {
    printLine = javaPrintResult("_result", retType);
  }

  const code = `import java.util.*;
import java.io.*;

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
    default: return `    printf("null\\n");`;
  }
}

function generateC(
  userCode: string,
  meta: ProblemMeta
): { code: string; filename: string } {
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
      return p.name;
    })
    .join(", ");

  let callAndPrint: string;
  if (retType === "void") {
    callAndPrint = `    ${fnName}(${cArgList});\n    printf("null\\n");`;
  } else if (retType === "int") {
    callAndPrint = `    int _result = ${fnName}(${cArgList});\n${cPrintResult("_result", "int")}`;
  } else if (retType === "bool") {
    callAndPrint = `    bool _result = ${fnName}(${cArgList});\n${cPrintResult("_result", "bool")}`;
  } else if (retType === "double") {
    callAndPrint = `    double _result = ${fnName}(${cArgList});\n${cPrintResult("_result", "double")}`;
  } else if (retType === "int[]") {
    callAndPrint = `    int _retSize = 0;\n    int* _result = ${fnName}(${cArgList}, &_retSize);\n${cPrintResult("_result", "int[]", "_retSize")}`;
  } else {
    callAndPrint = `    // unsupported return type: ${retType}\n    printf("null\\n");`;
  }

  const code = `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>

${userCode}

int main() {
    char _sep[8];
    while (!feof(stdin)) {
${readArgs}
${callAndPrint}
        if(!fgets(_sep,8,stdin)) break; // read "---" separator
    }
    return 0;
}
`;
  return { code, filename: "solution.c" };
}
