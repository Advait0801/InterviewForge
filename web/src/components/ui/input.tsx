import { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: Props) {
  return (
    <input
      className={`w-full rounded-xl border border-border bg-background px-3 py-2 text-text-primary outline-none ring-0 placeholder:text-text-secondary focus:border-primary ${className}`}
      {...props}
    />
  );
}
