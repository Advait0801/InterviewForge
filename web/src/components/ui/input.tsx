import { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
};

export function Input({ className = "", error, ...props }: Props) {
  return (
    <div className="w-full">
      <input
        className={`w-full rounded-xl border border-border bg-background px-3 py-2 text-text-primary outline-none ring-0 placeholder:text-text-secondary focus:border-primary ${error ? "border-error" : ""} ${className}`}
        {...props}
      />
      {error ? <p className="mt-1 text-xs text-error">{error}</p> : null}
    </div>
  );
}
