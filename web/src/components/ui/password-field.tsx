"use client";

import { InputHTMLAttributes, useId, useState } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  error?: string;
  label?: string;
  hint?: string;
};

export function PasswordField({ className = "", error, label, hint, id, "aria-describedby": describedBy, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const localDescriptionId = error || hint ? `${inputId}-description` : undefined;
  const descriptionId = [describedBy, localDescriptionId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="w-full">
      {label ? <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor={inputId}>{label}</label> : null}
      <div className="relative">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={descriptionId}
          className={`w-full rounded-xl border border-border bg-background/80 px-3.5 py-2.5 pr-11 text-text-primary outline-none ring-0 transition-[border-color,box-shadow] duration-200 placeholder:text-text-secondary/60 focus:border-primary focus:ring-2 focus:ring-primary/20 ${error ? "border-error focus:border-error focus:ring-error/20" : ""} ${className}`}
          {...props}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          )}
        </button>
      </div>
      {error || hint ? <p id={localDescriptionId} className={`mt-1.5 text-xs ${error ? "text-error" : "text-text-secondary"}`}>{error ?? hint}</p> : null}
    </div>
  );
}
