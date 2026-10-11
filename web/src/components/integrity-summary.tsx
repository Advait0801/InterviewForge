import type { Integrity } from "@/lib/api";

export const PROCTORING_NOTICE =
  "This assessment records when you leave this tab or window, paste or copy (only how many characters, never the text), and exit fullscreen. It's shown to you with your result and doesn't change your score.";
export function IntegritySummary({ integrity }: { integrity: Integrity }) {
  return (
    <section
      aria-labelledby="integrity-heading"
      className="my-6 space-y-4 rounded-2xl border border-border bg-surface/70 p-5"
    >
      <h2 id="integrity-heading" className="text-xl font-semibold">
        Integrity summary
      </h2>
      <p className="text-sm text-text-secondary">
        These observations are for review and do not change your score.
      </p>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        {[
          ["Tab switches", integrity.tabSwitches],
          ["Time away", `${integrity.hiddenSeconds} seconds`],
          ["Window blurs", integrity.windowBlurs],
          [
            "Pastes",
            `${integrity.pastes} (${integrity.pastedChars} characters)`,
          ],
          ["Largest paste", `${integrity.largestPaste} characters`],
          ["Copies", integrity.copies],
          ["Fullscreen exits", integrity.fullscreenExits],
        ].map(([name, value]) => (
          <div key={name}>
            <dt className="text-text-secondary">{name}</dt>
            <dd className="mt-1 font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <h3 className="font-semibold">Worth reviewing</h3>
      {integrity.flags.length ? (
        <ul className="list-inside list-disc space-y-1 text-sm text-text-secondary">
          {integrity.flags.map((flag) => (
            <li key={flag}>{flag}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-secondary">No indicators flagged.</p>
      )}
    </section>
  );
}
