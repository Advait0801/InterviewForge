import { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "ghost" | "danger";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white shadow-lg shadow-primary/20 hover:opacity-90",
  ghost: "bg-transparent text-text-primary border border-border hover:border-primary",
  danger: "bg-error text-white hover:opacity-90",
};

export function Button({ variant = "primary", className = "", ...props }: Props) {
  return (
    <button
      className={`rounded-xl px-4 py-2 font-medium transition ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
