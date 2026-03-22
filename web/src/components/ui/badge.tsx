export function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClasses =
    tone === "success"
      ? "bg-accent/15 text-accent border-accent/25 shadow-sm shadow-accent/10"
      : tone === "warning"
        ? "bg-warning/15 text-warning border-warning/25 shadow-sm shadow-warning/10"
        : tone === "danger"
          ? "bg-error/15 text-error border-error/25 shadow-sm shadow-error/10"
          : "bg-secondary/15 text-secondary border-secondary/25 shadow-sm shadow-secondary/10";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${toneClasses}`}>
      {children}
    </span>
  );
}
