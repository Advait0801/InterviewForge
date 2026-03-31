"use client";

import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";

export type WorkspaceLanguage = "python3" | "cpp" | "c" | "java";

const MONACO_LANG: Record<WorkspaceLanguage, string> = {
  python3: "python",
  cpp: "cpp",
  c: "c",
  java: "java",
};

function defineInterviewForgeTheme(monaco: typeof Monaco) {
  monaco.editor.defineTheme("interviewforge-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6A9955" },
      { token: "comment.doc", foreground: "6A9955" },
      { token: "comment.line", foreground: "6A9955" },
      { token: "comment.block", foreground: "6A9955" },
    ],
    colors: {
      "editor.background": "#0a0e17",
      "editor.foreground": "#d4d4d8",
    },
  });
}

export function CodeWorkspaceEditor({
  language,
  value,
  onChange,
  readOnly,
  className,
}: {
  language: WorkspaceLanguage;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  className?: string;
}) {
  const beforeMount: BeforeMount = (monaco) => {
    defineInterviewForgeTheme(monaco);
  };

  const onMount: OnMount = (ed, monaco) => {
    monaco.editor.setTheme("interviewforge-dark");
    if (!readOnly) ed.focus();
  };

  return (
    <div className={className ?? "min-h-0 min-w-0 flex-1"}>
      <Editor
        height="100%"
        language={MONACO_LANG[language]}
        theme="interviewforge-dark"
        value={value}
        beforeMount={beforeMount}
        onMount={onMount}
        onChange={(v) => onChange(v ?? "")}
        options={{
          tabSize: 4,
          insertSpaces: true,
          detectIndentation: false,
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 14,
          lineHeight: 22,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          autoIndent: "full",
          formatOnPaste: false,
          formatOnType: false,
          autoClosingBrackets: "always",
          autoClosingQuotes: "always",
          autoSurround: "languageDefined",
          bracketPairColorization: { enabled: true },
          readOnly: readOnly ?? false,
          smoothScrolling: true,
          cursorBlinking: "smooth",
          padding: { top: 12, bottom: 12 },
        }}
      />
    </div>
  );
}
