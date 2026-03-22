import { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "ghost" | "danger";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:brightness-110",
  ghost:
    "bg-transparent text-text-primary border border-border hover:border-primary/50 hover:bg-primary/5",
  danger:
    "bg-gradient-to-r from-error to-red-500 text-white shadow-lg shadow-error/20 hover:shadow-xl hover:shadow-error/30",
};

export function Button({ variant = "primary", className = "", ...props }: Props) {
  return (
    <button
      className={`rounded-xl px-5 py-2.5 font-medium transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
