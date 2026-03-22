import { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
};

export function Input({ className = "", error, ...props }: Props) {
  return (
    <div className="w-full">
      <input
        className={`w-full rounded-xl border border-border bg-background/80 px-3.5 py-2.5 text-text-primary outline-none ring-0 transition-all duration-200 placeholder:text-text-secondary/60 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:shadow-lg focus:shadow-glow-primary ${error ? "border-error focus:ring-error/20" : ""} ${className}`}
        {...props}
      />
      {error ? <p className="mt-1.5 text-xs text-error">{error}</p> : null}
    </div>
  );
}
