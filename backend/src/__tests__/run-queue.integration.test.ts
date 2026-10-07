import { Queue } from "bullmq";
import { afterEach, describe, expect, it } from "vitest";
import { CodeRunnerFailedError, CodeRunnerUnreachableError, type RunRequest } from "../services/code-runner.client";
import { RunQueueBusyError, runQueued, startRunQueue, stopRunQueue } from "../services/run-queue";

/**
 * Against a real Redis (D-063). Set REDIS_TEST_URL to run, e.g.
 *   REDIS_TEST_URL=redis://localhost:6380 npx vitest run run-queue
 * CI provides one. Each test uses its own queue name and obliterates it afterwards.
 */
const url = process.env.REDIS_TEST_URL;
const request: RunRequest = { language: "python3", code: "", testCases: [], slug: "two-sum" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const queueName = () => `code-runs-test-${process.pid}-${Math.random().toString(36).slice(2)}`;

describe.skipIf(!url)("run queue (Redis)", () => {
  afterEach(() => stopRunQueue({ obliterate: true }));

  it("never runs more than the cap at once, and every job completes", async () => {
    let inFlight = 0;
    let peak = 0;
    await startRunQueue({
      url,
      queueName: queueName(),
      concurrency: 3,
      runner: async () => {
        peak = Math.max(peak, ++inFlight);
        await sleep(80);
        inFlight--;
        return { passed: true, results: [] };
      },
    });
    const results = await Promise.all(Array.from({ length: 15 }, () => runQueued(request)));
    expect(results.every((r) => r.passed)).toBe(true);
    expect(peak).toBe(3);
  });

  it("leaves no job (code, hidden test cases) behind in Redis", async () => {
    const name = queueName();
    let call = 0;
    await startRunQueue({
      url,
      queueName: name,
      runner: async () => {
        if (++call === 2) throw new CodeRunnerFailedError("500");
        return { passed: true, results: [] };
      },
    });
    await runQueued(request);
    await expect(runQueued(request)).rejects.toBeInstanceOf(CodeRunnerFailedError);
    const probe = new Queue(name, { connection: { url } });
    const counts = await probe.getJobCounts("completed", "failed", "waiting", "active");
    await probe.close();
    expect(Object.values(counts).every((n) => n === 0)).toBe(true);
  });

  it("maps runner failures back to their error types", async () => {
    let call = 0;
    await startRunQueue({
      url,
      queueName: queueName(),
      runner: async () => {
        call++;
        if (call === 1) throw new CodeRunnerUnreachableError("down");
        throw new CodeRunnerFailedError("500");
      },
    });
    await expect(runQueued(request)).rejects.toBeInstanceOf(CodeRunnerUnreachableError);
    await expect(runQueued(request)).rejects.toBeInstanceOf(CodeRunnerFailedError);
  });

  it("gives up with RunQueueBusyError when the queue is saturated", async () => {
    await startRunQueue({
      url,
      queueName: queueName(),
      concurrency: 1,
      waitTimeoutMs: 300,
      runner: async () => {
        await sleep(1_000);
        return { passed: true, results: [] };
      },
    });
    const outcomes = await Promise.allSettled([runQueued(request), runQueued(request)]);
    expect(outcomes.every((o) => o.status === "rejected" && o.reason instanceof RunQueueBusyError)).toBe(true);
  });
});
