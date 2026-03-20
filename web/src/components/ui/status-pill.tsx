export function StatusPill({
  label,
  tone = "secondary",
}: {
  label: string;
  tone?: "success" | "warning" | "secondary";
}) {
  const toneClasses =
    tone === "success"
      ? "border-accent/30 bg-accent/10 text-accent"
      : tone === "warning"
        ? "border-warning/30 bg-warning/10 text-warning"
        : "border-secondary/30 bg-secondary/10 text-secondary";

  return <span className={`rounded-full border px-3 py-1 text-xs font-medium ${toneClasses}`}>{label}</span>;
}
