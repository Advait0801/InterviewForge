export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface/80 backdrop-blur-sm p-4 transition-all duration-300 hover:border-border-hover hover:shadow-lg hover:shadow-glow-primary ${className}`}
    >
      {children}
    </div>
  );
}
