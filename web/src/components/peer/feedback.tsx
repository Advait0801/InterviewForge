"use client";

import { useState, type FormEvent } from "react";
import { api, type PeerSession } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";

const labels: Record<string, string> = {
  problemSolving: "Problem solving",
  communication: "Communication",
  codeQuality: "Code quality",
  clarity: "Clarity",
  helpfulness: "Helpfulness",
};
export function PeerFeedback({
  session,
  onSaved,
}: {
  session: PeerSession;
  onSaved: (session: PeerSession) => void;
}) {
  const keys =
    session.myRole === "interviewer"
      ? ["problemSolving", "communication", "codeQuality"]
      : ["clarity", "helpfulness"];
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!keys.every((key) => ratings[key] >= 1 && ratings[key] <= 5)) {
      setError("Choose a rating from 1 to 5 for every category.");
      return;
    }
    setSaving(true);
    try {
      const response = await api.submitPeerFeedback(session.id, {
        ratings: Object.fromEntries(keys.map((k) => [k, ratings[k]])),
        notes,
      });
      onSaved(response.session);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save feedback. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      <Card className="min-w-0 space-y-4">
        <h2 className="text-xl font-semibold">Your feedback</h2>
        {session.feedback.given ? (
          <StatePanel
            title="Feedback submitted"
            description="Your feedback has been shared with your partner. It can be given once."
          />
        ) : session.status === "cancelled" ? (
          <StatePanel
            title="Interview cancelled"
            description="Feedback is available after a completed interview."
          />
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            <p className="text-sm text-text-secondary">
              Rate your partner from 1 (needs work) to 5 (excellent). Feedback
              can be submitted once.
            </p>
            {keys.map((key) => (
              <div key={key}>
                <label
                  htmlFor={`feedback-${key}`}
                  className="mb-1.5 block text-sm font-medium"
                >
                  {labels[key]}
                </label>
                <select
                  required
                  id={`feedback-${key}`}
                  value={ratings[key] ?? ""}
                  onChange={(e) =>
                    setRatings((r) => ({ ...r, [key]: Number(e.target.value) }))
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2"
                >
                  <option value="">Choose a rating</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <div>
              <label
                htmlFor="peer-feedback-notes"
                className="mb-1.5 block text-sm font-medium"
              >
                Notes (optional)
              </label>
              <textarea
                id="peer-feedback-notes"
                maxLength={2000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-border bg-background px-3 py-2"
              />
              <p className="text-xs text-text-secondary">
                {notes.length} character{notes.length === 1 ? "" : "s"} · 2,000
                maximum
              </p>
            </div>
            {error && (
              <p role="alert" className="text-sm text-error">
                {error}
              </p>
            )}
            <Button
              type="submit"
              loading={saving}
              loadingLabel="Saving feedback…"
            >
              Submit feedback
            </Button>
          </form>
        )}
      </Card>
      <Card className="min-w-0 space-y-4">
        <h2 className="text-xl font-semibold">Partner&apos;s feedback</h2>
        {session.feedback.received ? (
          <>
            <dl className="space-y-2">
              {Object.entries(session.feedback.received.ratings).map(
                ([key, n]) => (
                  <div
                    className="flex flex-wrap justify-between gap-2"
                    key={key}
                  >
                    <dt>{labels[key] ?? key}</dt>
                    <dd>{n}/5</dd>
                  </div>
                ),
              )}
            </dl>
            {session.feedback.received.notes && (
              <p className="whitespace-pre-wrap break-words text-sm text-text-secondary">
                {session.feedback.received.notes}
              </p>
            )}
          </>
        ) : (
          <StatePanel
            title="No partner feedback yet"
            description="Your partner can share feedback after the interview."
          />
        )}
      </Card>
    </div>
  );
}
