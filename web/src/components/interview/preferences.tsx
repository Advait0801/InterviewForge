import type { InterviewMode, Persona } from "@/lib/api";

export function Preferences({ persona, mode, onPersona, onMode, disabled }: {
  persona: Persona; mode: InterviewMode | undefined; onPersona: (value: Persona) => void; onMode: (value: InterviewMode | undefined) => void; disabled: boolean;
}) {
  return <div className="grid gap-5 sm:grid-cols-2">
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-2 text-lg font-semibold">Interviewer tone</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-3">{(["neutral", "friendly", "terse", "adversarial"] as const).map((value) => <label key={value} className="flex min-h-11 items-center gap-2 text-sm capitalize">
        <input type="radio" name="persona" value={value} checked={persona === value} onChange={() => onPersona(value)} className="accent-primary" />{value.charAt(0).toUpperCase() + value.slice(1)}
      </label>)}</div>
      <p className="text-xs text-text-secondary">Changes the interviewer’s tone.</p>
    </fieldset>
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-2 text-lg font-semibold">Interview mode</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-3">
        {([{ value: undefined, label: "Server default (Classic)" }, { value: "fixed", label: "Classic" }, { value: "agent", label: "Adaptive" }] as const).map(({ value, label }) =>
          <label key={value ?? "default"} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="radio" name="mode" checked={mode === value} onChange={() => onMode(value)} className="accent-primary" />{label}
          </label>)}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-text-secondary">{mode === "agent" ? "The interviewer decides when to dig deeper, switch topic or move on. Up to 3 questions per stage." : "Each stage has a question and at most one follow-up."}</p>
    </fieldset>
  </div>;
}
