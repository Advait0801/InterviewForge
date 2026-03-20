export function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClasses =
    tone === "success"
      ? "bg-accent/15 text-accent border-accent/20"
      : tone === "warning"
        ? "bg-warning/15 text-warning border-warning/20"
        : tone === "danger"
          ? "bg-error/15 text-error border-error/20"
          : "bg-secondary/15 text-secondary border-secondary/20";
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${toneClasses}`}>{children}</span>;
}
