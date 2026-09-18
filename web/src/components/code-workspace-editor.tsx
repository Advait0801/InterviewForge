"use client";

import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/ui/theme-provider";

export type WorkspaceLanguage = "python3" | "cpp" | "c" | "java";

const MONACO_LANG: Record<WorkspaceLanguage, string> = {
  python3: "python",
  cpp: "cpp",
  c: "c",
  java: "java",
};

function defineInterviewForgeThemes(monaco: typeof Monaco) {
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
      "editorLineNumber.foreground": "#64748b",
      "editorLineNumber.activeForeground": "#cbd5e1",
      "editor.selectionBackground": "#3730a380",
      "editor.inactiveSelectionBackground": "#33415566",
      "editorCursor.foreground": "#a5b4fc",
      "editorIndentGuide.background1": "#1e293b",
      "editorIndentGuide.activeBackground1": "#475569",
    },
  });
  monaco.editor.defineTheme("interviewforge-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "587A45" },
      { token: "comment.doc", foreground: "587A45" },
      { token: "comment.line", foreground: "587A45" },
      { token: "comment.block", foreground: "587A45" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#0f172a",
      "editorLineNumber.foreground": "#94a3b8",
      "editorLineNumber.activeForeground": "#475569",
      "editor.selectionBackground": "#c7d2fe",
      "editor.inactiveSelectionBackground": "#e2e8f0",
      "editorCursor.foreground": "#4f46e5",
      "editorIndentGuide.background1": "#e2e8f0",
      "editorIndentGuide.activeBackground1": "#94a3b8",
    },
  });
}

function subscribeToReducedMotion(onChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  const { theme } = useTheme();
  const reducedMotion = useSyncExternalStore(subscribeToReducedMotion, getReducedMotion, () => false);
  const editorTheme = theme === "dark" ? "interviewforge-dark" : "interviewforge-light";

  const beforeMount: BeforeMount = (monaco) => {
    defineInterviewForgeThemes(monaco);
  };

  const onMount: OnMount = (ed, monaco) => {
    monaco.editor.setTheme(editorTheme);
    ed.layout();
  };

  return (
    <div className={className ?? "min-h-0 min-w-0 flex-1"}>
      <Editor
        height="100%"
        language={MONACO_LANG[language]}
        theme={editorTheme}
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
          readOnlyMessage: { value: "This assessment is complete. The submitted code is read-only." },
          smoothScrolling: !reducedMotion,
          cursorBlinking: reducedMotion ? "solid" : "smooth",
          ariaLabel: readOnly ? "Read-only code editor" : "Code editor",
          padding: { top: 12, bottom: 12 },
        }}
      />
    </div>
  );
}
