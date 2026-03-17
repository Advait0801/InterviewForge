import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import runRoutes from "./routes/run.routes";

dotenv.config();

const app = express();
const PORT = process.env.CODE_RUNNER_PORT || 5000;

app.use(cors());
app.use(express.json());

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