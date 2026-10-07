import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { apiLimiter } from "./middleware/rate-limit.middleware";
import { optionalAuth } from "./middleware/auth.middleware";
import { resolveJwtSecret } from "./auth";
import {
  correlationId,
  setCurrentCorrelationId,
  type CorrelatedRequest,
} from "./middleware/correlation.middleware";
import { Server } from "socket.io";
import { API_ROUTES } from "./routes";
import { validateResponses } from "./openapi/validate-responses.middleware";

dotenv.config();

// Fail at boot, not on the first login: a missing or weak secret means forgeable tokens.
try {
  resolveJwtSecret();
} catch (err) {
  console.error(`[startup] ${(err as Error).message}`);
  process.exit(1);
}

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

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`[socket.io] client connected: ${socket.id}`);
  socket.emit("hello", { message: "InterviewForge realtime channel ready" });
  socket.on("disconnect", (reason) => {
    console.log(`[socket.io] client disconnected: ${socket.id}`, reason);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`🔌 Socket.IO listening on the same port`);
});
