"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, Assessment } from "@/lib/api";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: "easeOut" as const },
  }),
};

const DIFFICULTY_OPTIONS = [
  { value: "mixed", label: "Mixed" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const TIME_OPTIONS = [30, 45, 60, 90, 120];

export default function AssessmentsPage() {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState("mixed");
  const [problemCount, setProblemCount] = useState(3);
  const [timeLimit, setTimeLimit] = useState(60);
  const [creating, setCreating] = useState(false);
  const [assessments, setAssessments] = useState<Assessment[]>([]);

  useEffect(() => {
    api.listAssessments().then((r) => setAssessments(r.assessments)).catch(() => {});
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await api.createAssessment({
        timeLimitMinutes: timeLimit,
        problemCount,
        difficultyMix: difficulty,
      });
      router.push(`/assessments/${res.assessmentId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create assessment");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Protected>
      <PageShell>
        <motion.div initial="hidden" animate="visible" className="space-y-8">
          <motion.div variants={fadeUp} custom={0}>
            <h1 className="mb-2 text-3xl font-bold sm:text-4xl lg:text-5xl tracking-tight">Online Assessment</h1>
            <p className="max-w-2xl text-text-secondary text-lg leading-relaxed">
              Timed coding test simulating a real online assessment. Choose your settings, then solve problems under time pressure.
            </p>
          </motion.div>

          {/* Config */}
          <motion.div variants={fadeUp} custom={1} className="grid gap-6 md:grid-cols-3">
            <Card>
              <h3 className="mb-3 font-semibold">Difficulty</h3>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTY_OPTIONS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDifficulty(d.value)}
                    className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-all ${
                      difficulty === d.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-text-secondary hover:border-border-hover"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="mb-3 font-semibold">Problems</h3>
              <div className="flex items-center gap-3">
                {[2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setProblemCount(n)}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-bold transition-all ${
                      problemCount === n
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-text-secondary hover:border-border-hover"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="mb-3 font-semibold">Time Limit</h3>
              <div className="flex flex-wrap gap-2">
                {TIME_OPTIONS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeLimit(t)}
                    className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-all ${
                      timeLimit === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-text-secondary hover:border-border-hover"
                    }`}
                  >
                    {t}m
                  </button>
                ))}
              </div>
            </Card>
          </motion.div>

          <motion.div variants={fadeUp} custom={2}>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Creating..." : "Start Assessment"}
            </Button>
          </motion.div>

          {/* Past assessments */}
          {assessments.length > 0 && (
            <motion.div variants={fadeUp} custom={3} className="space-y-3">
              <h2 className="text-lg font-semibold text-text-secondary">Past Assessments</h2>
              <div className="space-y-2">
                {assessments.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => router.push(`/assessments/${a.id}`)}
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-surface/60 p-4 text-left transition-all hover:border-primary/30 hover:bg-surface"
                  >
                    <div>
                      <p className="text-sm font-semibold">
                        {a.problem_count} problems &middot; {a.difficulty_mix} &middot; {a.time_limit_minutes}m
                      </p>
                      <p className="text-xs text-text-secondary">
                        {new Date(a.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {a.score != null && (
                        <span className={`text-lg font-bold ${Number(a.score) >= 50 ? "text-accent" : "text-error"}`}>
                          {a.score}%
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                          a.status === "completed"
                            ? "bg-accent/10 text-accent border border-accent/20"
                            : "bg-warning/10 text-warning border border-warning/20"
                        }`}
                      >
                        {a.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      </PageShell>
    </Protected>
  );
}
