import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { apiLimiter } from "./middleware/rate-limit.middleware";
import { errorHandler, notFound } from "./middleware/errors.middleware";
import { optionalAuth } from "./middleware/auth.middleware";
import { resolveJwtSecret } from "./auth";
import { getMailer, resolveEmailConfig, settleEmails } from "./services/email";
import {
  correlationId,
  setCurrentCorrelationId,
  type CorrelatedRequest,
} from "./middleware/correlation.middleware";
import { API_ROUTES } from "./routes";
import { attachRealtime } from "./realtime";
import { validateResponses } from "./openapi/validate-responses.middleware";
import { redisUrl } from "./redis";
import { RUN_CONCURRENCY, startRunQueue, stopRunQueue } from "./services/run-queue";

dotenv.config();

// Fail at boot, not on the first login: a missing or weak secret means forgeable tokens.
// Email too (D-072): EMAIL_PROVIDER=resend with no key would leave every user unable to
// reset a password, while the server looked healthy.
try {
  resolveJwtSecret();
  resolveEmailConfig();
} catch (err) {
  console.error(`[startup] ${(err as Error).message}`);
  process.exit(1);
}
console.log(`[startup] email: ${getMailer().provider}`);

const app = express();

// Behind a reverse proxy (Nginx in prod) req.ip is the proxy's address unless Express is
// told to trust X-Forwarded-For, which would put every user in one rate-limit bucket.
// Set TRUST_PROXY to the number of proxy hops; leave it unset when clients connect
// directly, since trusting the header then would let anyone spoof their IP.
const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY ?? "", 10);
if (Number.isFinite(trustProxyHops) && trustProxyHops > 0) {
  app.set("trust proxy", trustProxyHops);
}

// Security headers. The API serves JSON only, so helmet's defaults cost nothing.
app.use(helmet());
const PORT = Number(process.env.BACKEND_PORT) || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
// Resumes arrive as base64 JSON (the same pattern as avatars), so the body
// limit has to clear a 5MB PDF plus base64 inflation. Express defaults to 100kb.
app.use(express.json({ limit: "8mb" }));

// Before the routes so every downstream call and log line can carry the id.
app.use(correlationId);
app.use((req, _res, next) => {
  setCurrentCorrelationId((req as CorrelatedRequest).correlationId);
  next();
});

// Dev-only contract check against real data (D-062); see the middleware.
if (process.env.OPENAPI_VALIDATE_RESPONSES === "1") {
  app.use("/api", validateResponses());
}

app.use("/api", optionalAuth, apiLimiter);

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "backend",
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.json({ message: "InterviewForge Backend API" });
});

for (const [mountPath, router] of API_ROUTES) {
  app.use(`/api${mountPath}`, router);
}

// JSON for unknown paths and for anything unhandled, including a malformed body, instead of
// Express's HTML pages (whose error page prints the stack trace).
app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);

// Socket.IO: the default namespace's hello, and peer interviews on /peer (D-078).
const realtime = attachRealtime(server, { frontendUrl: FRONTEND_URL });

server.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`🔌 Socket.IO listening on the same port`);
});

// Bounded code execution (D-063). Until the queue is ready (it waits for Redis), runs answer
// a retryable 503 rather than bypassing the cap; see runQueued.
if (redisUrl()) {
  startRunQueue()
    .then(() => console.log(`🧵 Code-run queue ready (global concurrency ${RUN_CONCURRENCY})`))
    .catch((err) => console.error(`[startup] code-run queue failed to start: ${(err as Error).message}`));
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    // Let running jobs finish so no sandbox is orphaned mid-run.
    // Let an email already handed to the provider finish sending.
    // Flush any shared code still waiting to be saved.
    Promise.allSettled([stopRunQueue(), settleEmails(), realtime.close()]).finally(() => process.exit(0));
  });
}
