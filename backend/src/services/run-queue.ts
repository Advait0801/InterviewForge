import { Queue, QueueEvents, Worker, type Job } from "bullmq";
import type { Redis } from "ioredis";
import { createConnection, redisUrl } from "../redis";
import {
  CodeRunnerFailedError,
  CodeRunnerUnreachableError,
  runCode,
  type RunRequest,
  type RunResult,
} from "./code-runner.client";

/**
 * Bounded code execution (D-063). Every run or submit becomes a BullMQ job, and a global
 * concurrency cap (shared by every backend instance through Redis) limits how many sandbox
 * containers exist at once. Before this, N simultaneous submissions started N containers.
 *
 * The HTTP request still waits for its result, so the API is unchanged. A job carries the
 * hidden test cases, so it's deleted as soon as its result is read (age purge as a backstop).
 */

function intFromEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const QUEUE_NAME = "code-runs";
export const RUN_CONCURRENCY = intFromEnv("CODE_RUN_CONCURRENCY", 4);
/** Queue wait plus execution. A run that can't start and finish in this long is a 503. */
const WAIT_TIMEOUT_MS = intFromEnv("CODE_RUN_QUEUE_TIMEOUT_MS", 90_000);
/** Longer than any run the sandbox allows, so a slow Java submit isn't treated as stalled. */
const LOCK_DURATION_MS = 120_000;
const PURGE = { age: 60 };
/** BullMQ connections queue commands while Redis is down; don't let a request wait on that. */
const ENQUEUE_TIMEOUT_MS = 5_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Redis was configured but the queue couldn't take the job. */
export class RunQueueUnavailableError extends Error {}
/** The job didn't finish within WAIT_TIMEOUT_MS: the queue is saturated. */
export class RunQueueBusyError extends Error {}

// Failure reasons travel through Redis as strings; these map them back to error types.
const UNREACHABLE = "code_runner_unreachable";
const FAILED = "code_runner_failed";

type Runner = (request: RunRequest) => Promise<RunResult>;

type State = { queue: Queue; events: QueueEvents; worker: Worker; connections: Redis[]; waitTimeoutMs: number };
let state: State | null = null;

export async function startRunQueue(
  options: { runner?: Runner; concurrency?: number; url?: string; queueName?: string; waitTimeoutMs?: number } = {}
): Promise<void> {
  if (state) return;
  const url = options.url ?? redisUrl();
  if (!url) throw new Error("REDIS_URL is not set");
  const runner = options.runner ?? runCode;
  const concurrency = options.concurrency ?? RUN_CONCURRENCY;
  const name = options.queueName ?? QUEUE_NAME;

  const bull = { maxRetriesPerRequest: null };
  const connections = [createConnection(bull, url), createConnection(bull, url), createConnection(bull, url)];
  const queue = new Queue(name, { connection: connections[0] });
  const events = new QueueEvents(name, { connection: connections[1] });
  const worker = new Worker<RunRequest, RunResult>(
    name,
    async (job: Job<RunRequest>) => {
      try {
        return await runner(job.data);
      } catch (err) {
        if (err instanceof CodeRunnerUnreachableError) throw new Error(UNREACHABLE);
        if (err instanceof CodeRunnerFailedError) throw new Error(FAILED);
        throw err;
      }
    },
    { connection: connections[2], concurrency, lockDuration: LOCK_DURATION_MS }
  );
  worker.on("error", (err) => {
    console.error(JSON.stringify({ level: "error", event: "run_queue_worker_error", message: err.message }));
  });

  // The per-worker `concurrency` caps this instance; the global cap holds across instances.
  await queue.setGlobalConcurrency(concurrency);
  await events.waitUntilReady();
  state = { queue, events, worker, connections, waitTimeoutMs: options.waitTimeoutMs ?? WAIT_TIMEOUT_MS };
}

export async function stopRunQueue(options: { obliterate?: boolean } = {}): Promise<void> {
  if (!state) return;
  const { queue, events, worker, connections } = state;
  state = null;
  if (options.obliterate) await queue.obliterate({ force: true }).catch(() => undefined);
  await worker.close();
  await events.close();
  await queue.close();
  await Promise.all(connections.map((c) => c.quit().catch(() => undefined)));
}

/**
 * Run code through the queue. With no REDIS_URL at all (unit tests, minimal dev) it runs
 * directly, as before. With REDIS_URL set, it never bypasses the queue: a missing or
 * unreachable queue is RunQueueUnavailableError, so an outage can't remove the cap.
 */
export async function runQueued(request: RunRequest): Promise<RunResult> {
  if (!state) {
    if (!redisUrl()) return runCode(request);
    throw new RunQueueUnavailableError("Run queue is not available");
  }
  const { queue, events, waitTimeoutMs } = state;

  let job: Job<RunRequest, RunResult>;
  try {
    job = await withTimeout(
      queue.add("run", request, { removeOnComplete: PURGE, removeOnFail: PURGE, attempts: 1 }),
      ENQUEUE_TIMEOUT_MS,
      "enqueue"
    );
  } catch (err) {
    console.error(JSON.stringify({ level: "error", event: "run_queue_add_failed", message: (err as Error).message }));
    throw new RunQueueUnavailableError("Run queue is not available");
  }

  try {
    const result = await job.waitUntilFinished(events, waitTimeoutMs);
    // The job holds the code and the hidden test cases. BullMQ's age-based purge only runs
    // when another job completes, so the last jobs before a quiet spell would sit in Redis
    // indefinitely; delete it as soon as its result is read.
    await job.remove().catch(() => undefined);
    return result;
  } catch (err) {
    if (!/timed out/i.test((err as Error).message)) await job.remove().catch(() => undefined);
    const message = (err as Error).message;
    if (message === UNREACHABLE) throw new CodeRunnerUnreachableError(message);
    if (message === FAILED) throw new CodeRunnerFailedError(message);
    if (/timed out/i.test(message)) {
      // Still waiting: take it out so it doesn't run for a client that has gone.
      await job.remove().catch(() => undefined);
      throw new RunQueueBusyError("Run queue is saturated");
    }
    throw err;
  }
}

/** Jobs waiting and running, for the load test and debugging. */
export async function runQueueCounts(): Promise<Record<string, number> | null> {
  if (!state) return null;
  return state.queue.getJobCounts("waiting", "active", "completed", "failed");
}
