"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { api, type RatingOutcome as Outcome } from "@/lib/api";
import { useApiResource } from "@/hooks/use-api-resource";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingState, StatePanel } from "@/components/ui/state-panel";

export function RatingOutcome({ outcome }: { outcome: Outcome | null }) {
  if (!outcome) return null;
  const delta = Math.round(outcome.delta);
  return (
    <p className="text-sm text-text-secondary">
      <strong className="text-text-primary">
        {delta >= 0 ? "+" : ""}
        {delta} rating
      </strong>
      {" · "}
      {Math.round(outcome.expected * 100)}% predicted to pass first time
      {outcome.score === 0.5 && " · passed after viewing hints"}
    </p>
  );
}

export function NextUp() {
  const [draft, setDraft] = useState("");
  const [topic, setTopic] = useState("");
  const load = useCallback(
    () => api.getNextProblems(topic || undefined),
    [topic],
  );
  const state = useApiResource(load);
  function filter(event: FormEvent) {
    event.preventDefault();
    setTopic(draft.trim());
  }
  return (
    <Card className="min-w-0 space-y-4">
      <h2 className="text-lg font-semibold">Next up for you</h2>
      <p className="text-sm text-text-secondary">
        Chosen to be about {Math.round((state.data?.target ?? 0.65) * 100)}%
        likely on your first submit.
      </p>
      <form onSubmit={filter} className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <Input
            label="Topic filter (optional)"
            value={draft}
            maxLength={64}
            placeholder="e.g. Arrays"
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
        <Button type="submit" size="sm" variant="secondary">
          Apply topic
        </Button>
        {topic && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft("");
              setTopic("");
            }}
          >
            Clear topic
          </Button>
        )}
      </form>
      {state.loading ? (
        <LoadingState label="Loading your next problems" className="min-h-24" />
      ) : state.error || state.missing ? (
        <StatePanel
          tone="error"
          title="Next problems unavailable"
          description={state.error ?? "The picks could not be found."}
          action={<Button onClick={state.reload}>Retry picks</Button>}
        />
      ) : !state.data?.picks.length ? (
        <StatePanel
          title="Nothing left in this selection"
          description="You have submitted every matching problem. Try another topic or clear the filter."
        />
      ) : (
        <ul className="space-y-3">
          {state.data.picks.map(({ problem, predictedSuccess }) => (
            <li
              key={problem.id}
              className="min-w-0 space-y-2 border-t border-border pt-3"
            >
              <Link
                href={`/problems/${problem.id}`}
                className="break-words font-semibold text-primary underline"
              >
                {problem.title}
              </Link>
              <div className="flex flex-wrap gap-2">
                <Badge>{problem.difficulty}</Badge>
                {problem.topics.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
              <p className="text-sm text-text-secondary">
                {Math.round(predictedSuccess * 100)}% predicted to pass first
                time
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function RatingsSection() {
  const load = useCallback(() => api.getRatings(), []);
  const state = useApiResource(load);
  return (
    <Card className="min-w-0 space-y-4">
      <h2 className="text-xl font-semibold">Your ratings</h2>
      {state.loading ? (
        <LoadingState label="Loading ratings" className="min-h-24" />
      ) : state.error || state.missing ? (
        <StatePanel
          tone="error"
          title="Ratings unavailable"
          description={state.error ?? "Your ratings could not be found."}
          action={<Button onClick={state.reload}>Retry ratings</Button>}
        />
      ) : !state.data?.overall.games ? (
        <StatePanel
          title="Your first Submit of any problem starts your rating"
          description="Each problem counts once. Passing after hints counts as half a win."
        />
      ) : (
        <>
          <p className="text-lg font-semibold">
            Overall: {Math.round(state.data.overall.rating)}{" "}
            <span className="text-sm font-normal text-text-secondary">
              · {state.data.overall.games} game
              {state.data.overall.games === 1 ? "" : "s"}
            </span>{" "}
            {state.data.overall.games < 10 && <Badge>Provisional</Badge>}
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...state.data.topics]
              .sort((a, b) => b.games - a.games)
              .map((item) => (
                <li
                  key={item.topic}
                  className="rounded-xl border border-border p-3"
                >
                  <h3 className="break-words font-semibold">{item.topic}</h3>
                  <p className="my-2 text-sm">
                    {Math.round(item.rating)} rating · {item.games} game
                    {item.games === 1 ? "" : "s"}
                  </p>
                  {item.games < 10 && <Badge>Provisional</Badge>}
                </li>
              ))}
          </ul>
          <p className="text-sm text-text-secondary">
            Ratings are provisional for the first 10 games. Only your first
            Submit of each problem counts.
          </p>
        </>
      )}
    </Card>
  );
}
