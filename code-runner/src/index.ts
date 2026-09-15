import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import runRoutes from "./routes/run.routes";

dotenv.config();

const app = express();
const PORT = process.env.CODE_RUNNER_PORT || 5000;

app.use(cors());
// The body carries every test case with its expected output. Express's 100kb
// default rejected subsets (~150kb: up to 1024 subsets per case) with a 413
// before any code ran, and fizz-buzz was already at ~99kb.
app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "code-runner",
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.json({ message: "InterviewForge Code Runner Service" });
});

app.use("/", runRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Code Runner service running on port ${PORT}`);
});