import { InputHTMLAttributes, useId } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  label?: string;
  hint?: string;
};

export function Input({ className = "", error, label, hint, id, "aria-describedby": describedBy, ...props }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const localDescriptionId = error || hint ? `${inputId}-description` : undefined;
  const descriptionId = [describedBy, localDescriptionId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="w-full">
      {label ? <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor={inputId}>{label}</label> : null}
      <input
        id={inputId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={descriptionId}
        className={`w-full rounded-xl border border-border bg-background/80 px-3.5 py-2.5 text-text-primary outline-none ring-0 transition-[border-color,box-shadow] duration-200 placeholder:text-text-secondary/60 focus:border-primary focus:ring-2 focus:ring-primary/20 ${error ? "border-error focus:border-error focus:ring-error/20" : ""} ${className}`}
        {...props}
      />
      {error || hint ? <p id={localDescriptionId} className={`mt-1.5 text-xs ${error ? "text-error" : "text-text-secondary"}`}>{error ?? hint}</p> : null}
    </div>
  );
}
