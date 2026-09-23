import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword, signAccessToken } from "../auth";
import {
  optionalAuth,
  requireAuth,
  SESSION_INVALID,
  type AuthRequest,
} from "../middleware/auth.middleware";
import authRoutes from "../routes/auth.routes";
import usersRoutes from "../routes/users.routes";

// A one-table fake of just the users queries these routes issue (D-055).
const db = vi.hoisted(() => ({
  users: new Map<string, { password_hash: string; token_version: number }>(),
  down: false,
}));

vi.mock("../db", () => ({
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    if (db.down) throw new Error("connect ECONNREFUSED");
    const id = params[params.length - 1] as string;
    const user = db.users.get(id);
    if (sql.startsWith("SELECT token_version FROM users")) {
      return { rows: user ? [{ token_version: user.token_version }] : [] };
    }
    if (sql.startsWith("SELECT password_hash FROM users")) {
      return { rows: user ? [{ password_hash: user.password_hash }] : [] };
    }
    if (sql.includes("token_version = token_version + 1")) {
      if (!user) return { rows: [] };
      if (sql.includes("password_hash = $1")) user.password_hash = params[0] as string;
      user.token_version += 1;
      return { rows: [{ token_version: user.token_version }] };
    }
    throw new Error(`Unexpected query in test: ${sql}`);
  }),
}));

const USER = "11111111-1111-4111-8111-111111111111";
const PASSWORD = "original-password";

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  // Mirrors index.ts: optionalAuth runs globally before the routers.
  app.use("/api", optionalAuth);
  app.use("/api/auth", authRoutes);
  app.use("/api/users", usersRoutes);
  app.get("/api/probe", requireAuth, (req: AuthRequest, res) => res.json({ user: req.user!.id }));
  app.get("/api/public", (req: AuthRequest, res) => res.json({ user: req.user?.id ?? null }));
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(async () => {
  db.down = false;
  db.users.clear();
  db.users.set(USER, { password_hash: await hashPassword(PASSWORD), token_version: 0 });
});

const tokenAt = (tokenVersion: number, userId = USER) => signAccessToken({ userId, tokenVersion });

async function call(path: string, token?: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe("token revocation", () => {
  it("accepts a token whose version matches", async () => {
    const r = await call("/probe", tokenAt(0));
    expect(r.status).toBe(200);
    expect(r.body.user).toBe(USER);
  });

  it("rejects a token issued before a version bump", async () => {
    db.users.get(USER)!.token_version = 1;
    const r = await call("/probe", tokenAt(0));
    expect(r.status).toBe(401);
    expect(r.body.code).toBe(SESSION_INVALID);
  });

  it("rejects a pre-revocation token that has no version claim (forced re-login)", async () => {
    const legacy = jwt.sign({ userId: USER }, process.env.JWT_SECRET!, { expiresIn: "7d" });
    const r = await call("/probe", legacy);
    expect(r.status).toBe(401);
    expect(r.body.code).toBe(SESSION_INVALID);
  });

  it("rejects a token for a user who no longer exists", async () => {
    db.users.delete(USER);
    const r = await call("/probe", tokenAt(0));
    expect(r.status).toBe(401);
    expect(r.body.code).toBe(SESSION_INVALID);
  });

  it("answers 503, not 401, when the database is down, so nobody is signed out by a blip", async () => {
    db.down = true;
    const r = await call("/probe", tokenAt(0));
    expect(r.status).toBe(503);
    expect(r.body.retryable).toBe(true);
    expect(r.body.code).toBeUndefined();
  });

  it("lets a revoked token through public routes as anonymous rather than failing them", async () => {
    db.users.get(USER)!.token_version = 3;
    const r = await call("/public", tokenAt(0));
    expect(r.status).toBe(200);
    expect(r.body.user).toBeNull();
  });

  it("looks the token up once per request even though two auth middlewares run", async () => {
    const { query } = await import("../db");
    vi.mocked(query).mockClear();
    await call("/probe", tokenAt(0));
    const lookups = vi.mocked(query).mock.calls.filter(([sql]) =>
      String(sql).startsWith("SELECT token_version")
    );
    expect(lookups).toHaveLength(1);
  });
});

describe("password change", () => {
  it("revokes other sessions and returns a working token for this one", async () => {
    const thisTab = tokenAt(0);
    const otherDevice = tokenAt(0);

    const r = await call("/users/change-password", thisTab, {
      currentPassword: PASSWORD,
      newPassword: "brand-new-password",
    });
    expect(r.status).toBe(200);
    expect(typeof r.body.token).toBe("string");

    expect((await call("/probe", otherDevice)).status).toBe(401);
    expect((await call("/probe", r.body.token as string)).status).toBe(200);
  });

  it("a wrong current password is a 401 that is not a session failure", async () => {
    // The web client signs out only on SESSION_INVALID; this 401 must not trigger it.
    const r = await call("/users/change-password", tokenAt(0), {
      currentPassword: "wrong",
      newPassword: "brand-new-password",
    });
    expect(r.status).toBe(401);
    expect(r.body.code).toBeUndefined();
    expect(db.users.get(USER)!.token_version).toBe(0);
  });
});

describe("sign out everywhere", () => {
  it("revokes every session, including the one that asked", async () => {
    const a = tokenAt(0);
    const b = tokenAt(0);
    expect((await call("/auth/logout-all", a, {})).status).toBe(200);
    expect((await call("/probe", a)).status).toBe(401);
    expect((await call("/probe", b)).status).toBe(401);
  });

  it("requires a live session", async () => {
    const r = await call("/auth/logout-all", undefined, {});
    expect(r.status).toBe(401);
  });
});
