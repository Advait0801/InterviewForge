import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Model calls the ai-service made on behalf of one piece of work (D-067). The ai-service
 * reports each response's calls in an `x-llm-usage` header (a stream: in its `done` event);
 * ai.service records them into the scope opened here, and the interview service charges
 * the total to the session when the work ends, success or not -- a failed turn still cost
 * money.
 */
export type Usage = { calls: number; costUsd: number };

const scope = new AsyncLocalStorage<Usage>();

/** Add a response's usage to the current scope, if there is one. */
export function recordUsage(usage: Partial<Usage> | undefined): void {
  const current = scope.getStore();
  if (!current || !usage) return;
  current.calls += Number(usage.calls) || 0;
  current.costUsd += Number(usage.costUsd) || 0;
}

/** What the current scope has spent so far. */
export function usageSoFar(): Usage {
  const current = scope.getStore();
  return current ? { ...current } : { calls: 0, costUsd: 0 };
}

/** Run `fn` in a fresh scope; `settle` receives the total once it ends, however it ends. */
export async function withUsage<T>(fn: () => Promise<T>, settle: (usage: Usage) => Promise<void>): Promise<T> {
  const usage: Usage = { calls: 0, costUsd: 0 };
  try {
    return await scope.run(usage, fn);
  } finally {
    if (usage.calls > 0) await settle(usage);
  }
}

/** Parse the ai-service's `x-llm-usage` header; anything malformed counts as nothing. */
export function parseUsageHeader(value: string | null): Usage | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as Partial<Usage>;
    return { calls: Number(parsed.calls) || 0, costUsd: Number(parsed.costUsd) || 0 };
  } catch {
    return undefined;
  }
}
