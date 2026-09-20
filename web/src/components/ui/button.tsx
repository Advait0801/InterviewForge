import { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "if-action-gradient text-white shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25 hover:brightness-105",
  secondary:
    "border border-primary/25 bg-primary/10 text-primary hover:border-primary/40 hover:bg-primary/15",
  ghost:
    "bg-transparent text-text-primary border border-border hover:border-primary/50 hover:bg-primary/5",
  danger:
    "if-action-danger-gradient text-white shadow-lg shadow-error/20 hover:shadow-xl hover:shadow-error/30",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "rounded-lg px-3 py-1.5 text-sm",
  md: "rounded-xl px-5 py-2.5 text-sm",
  lg: "rounded-xl px-6 py-3 text-base",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return `inline-flex items-center justify-center gap-2 font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:scale-[0.98] ${sizeClasses[size]} ${variantClasses[variant]} ${className}`;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel = "Working…",
  className = "",
  children,
  disabled,
  ...props
}: Props) {
  return (
    <button
      type="button"
      className={`${buttonStyles({ variant, size, className })} disabled:pointer-events-none disabled:opacity-50`}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
          <span>{loadingLabel}</span>
        </>
      ) : children}
    </button>
  );
}
