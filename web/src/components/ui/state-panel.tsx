import type { ReactNode } from "react";

type StateTone = "neutral" | "error";

const toneClasses: Record<StateTone, string> = {
  neutral: "border-border bg-surface/70",
  error: "border-error/30 bg-error/5",
};

export function StatePanel({
  title,
  description,
  action,
  icon,
  tone = "neutral",
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  tone?: StateTone;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border p-6 text-center ${toneClasses[tone]} ${className}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {icon ? <div className="mx-auto mb-3 flex w-fit text-text-secondary">{icon}</div> : null}
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      {description ? <p className="mx-auto mt-1.5 max-w-xl text-sm leading-6 text-text-secondary">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </section>
  );
}

export function LoadingState({ label = "Loading", className = "" }: { label?: string; className?: string }) {
  return (
    <div
      className={`flex min-h-48 items-center justify-center gap-3 text-sm text-text-secondary ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
