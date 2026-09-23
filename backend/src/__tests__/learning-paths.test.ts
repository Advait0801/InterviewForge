import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signAccessToken } from "../auth";
import learningPathsRouter from "../routes/learningPaths.routes";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("../db", () => ({ query: mocks.query }));

describe("learning path summaries", () => {
  const servers: Server[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT token_version FROM users")) {
        return { rows: [{ token_version: 0 }] };
      }
      if (sql.includes("FROM learning_paths lp")) {
        return {
          rows: [{
            id: "path-id",
            slug: "array-foundations",
            title: "Array Foundations",
            description: "Build array techniques.",
            topic: "Arrays",
            difficulty_level: "beginner",
            problem_count: "2",
          }],
        };
      }
      if (sql.includes("FROM user_path_progress")) {
        // Two historical progress rows exist, but only one problem remains a
        // member. The JOIN is what makes the database return the truthful count.
        return { rows: [{ path_id: "path-id", cnt: sql.includes("JOIN learning_path_problems") ? "1" : "2" }] };
      }
      throw new Error(`Unexpected query in test: ${sql}`);
    });
  });

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })));
  });

  it("excludes progress for problems removed from the current path membership", async () => {
    const app = express();
    app.use("/api/learning-paths", learningPathsRouter);
    const server = app.listen(0, "127.0.0.1");
    servers.push(server);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;

    const response = await fetch(`http://127.0.0.1:${port}/api/learning-paths`, {
      headers: { Authorization: `Bearer ${signAccessToken({ userId: "user-id", tokenVersion: 0 })}` },
    });
    const payload = await response.json() as { paths: Array<{ completedCount: number; problemCount: number }> };

    expect(response.status).toBe(200);
    expect(payload.paths).toEqual([expect.objectContaining({ completedCount: 1, problemCount: 2 })]);
    // The first call is optionalAuth's revocation lookup (D-055); the route's own
    // queries follow it.
    const routeQueries = mocks.query.mock.calls
      .map(([sql]) => sql as string)
      .filter((sql) => !sql.includes("SELECT token_version FROM users"));
    expect(routeQueries).toHaveLength(2);
    expect(routeQueries[1]).toContain("JOIN learning_path_problems");
    expect(routeQueries[1]).toContain("lpp.problem_id = upp.problem_id");
  });
});
