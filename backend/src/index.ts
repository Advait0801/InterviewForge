import http from "http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import authRoutes from "./routes/auth.routes";
import usersRoutes from "./routes/users.routes";
import problemsRoutes from "./routes/problems.routes";
import problemBookmarksRoutes from "./routes/problemBookmarks.routes";
import submissionRoutes from "./routes/submission.routes";
import interviewsRoutes from "./routes/interviews.routes";
import assessmentsRoutes from "./routes/assessments.routes";
import leaderboardRoutes from "./routes/leaderboard.routes";

dotenv.config();

const app = express();
const PORT = Number(process.env.BACKEND_PORT) || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", apiLimiter);

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

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/problems", problemsRoutes);
app.use("/api/problem-bookmarks", problemBookmarksRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/interviews", interviewsRoutes);
app.use("/api/assessments", assessmentsRoutes);
app.use("/api/leaderboard", leaderboardRoutes);

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
