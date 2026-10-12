import { useId } from "react";
import type { Language } from "@/lib/api";

export const languages: { value: Language; label: string }[] = [
  { value: "python3", label: "Python 3" },
  { value: "cpp", label: "C++" },
  { value: "c", label: "C" },
  { value: "java", label: "Java" },
  { value: "javascript", label: "JavaScript" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
];
export function asLanguage(value: string): Language {
  return languages.find((l) => l.value === value)?.value ?? "python3";
}
export function LanguagePicker({
  value,
  onChange,
  disabled,
}: {
  value: Language;
  onChange: (value: Language) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mr-2 text-sm font-medium">
        Language
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(asLanguage(e.target.value))}
        className="max-w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
      >
        {languages.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
