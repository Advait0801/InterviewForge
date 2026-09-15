import type { HTMLAttributes } from "react";

type CardVariant = "default" | "interactive" | "subtle";

const variants: Record<CardVariant, string> = {
  default: "border-border bg-surface/85 shadow-sm shadow-black/[0.02]",
  interactive: "border-border bg-surface/85 shadow-sm hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-glow-primary",
  subtle: "border-border/70 bg-surface/55",
};

export function Card({
  children,
  className = "",
  variant = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  return (
    <div
      className={`rounded-2xl border p-4 backdrop-blur-sm transition-[border-color,box-shadow,transform] duration-200 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
