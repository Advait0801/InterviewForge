import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes";
import usersRoutes from "./routes/users.routes";
import problemsRoutes from "./routes/problems.routes";
import submissionRoutes from "./routes/submission.routes";
import interviewsRoutes from "./routes/interviews.routes";
import assessmentsRoutes from "./routes/assessments.routes";

dotenv.config();

const app = express();
const PORT = process.env.BACKEND_PORT || 4000;

app.use(cors());
app.use(express.json());

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
app.use("/api/submissions", submissionRoutes);
app.use("/api/interviews", interviewsRoutes);
app.use("/api/assessments", assessmentsRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
});